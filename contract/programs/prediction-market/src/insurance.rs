//! ✅ v3.2.0: 保险池资金隔离验证模块（修复 High 问题）
//!
//! **问题背景**：
//! - 保险池资金分散存储在各市场的 market_usdc_ata 中
//! - global_config.lp_insurance_pool_balance 只是记账
//! - market.insurance_pool_contribution 追踪单个市场贡献
//! - 缺乏强制隔离机制，可能导致跨市场资金混乱
//!
//! **解决方案**：
//! - 提供严格的市场级限额检查
//! - 确保补偿金额不超过该市场的贡献额
//! - 防止市场 A 的保险池资金被市场 B 的 LP 领走

use crate::errors::PredictionMarketError;
use crate::state::{config::Config, market::Market};
use anchor_lang::prelude::*;

/// 保险池验证器
pub struct InsurancePoolValidator;

impl InsurancePoolValidator {
    /// 验证保险池补偿请求的合法性
    ///
    /// # 参数
    /// * `global_config` - 全局配置（包含保险池总余额）
    /// * `market` - 市场账户（包含该市场的贡献额）
    /// * `requested_compensation` - 请求的补偿金额
    ///
    /// # 返回
    /// * `Result<u64>` - 实际可补偿的金额（可能小于请求金额）
    ///
    /// # 验证规则
    /// 1. 保险池必须启用（global_config.insurance_pool_enabled）
    /// 2. 补偿金额不能超过全局保险池余额
    /// 3. 补偿金额不能超过该市场的累计贡献额
    /// 4. 补偿后，该市场的剩余贡献额必须 >= 0
    ///
    /// # 错误
    /// * `InsurancePoolNotEnabled` - 保险池未启用
    /// * `InsufficientBalance` - 全局保险池余额不足
    /// * `InvalidParameter` - 请求金额超过市场贡献额
    pub fn validate_compensation(
        global_config: &Config,
        market: &Market,
        requested_compensation: u64,
    ) -> Result<u64> {
        // 1. 检查保险池是否启用
        require!(
            global_config.insurance_pool_enabled,
            PredictionMarketError::InsurancePoolNotEnabled
        );

        // 2. 检查全局保险池余额
        let global_balance = global_config.lp_insurance_pool_balance;
        require!(
            global_balance > 0,
            PredictionMarketError::InsufficientBalance
        );

        // 3. 检查市场级贡献额
        let market_contribution = market.insurance_pool_contribution;
        require!(
            market_contribution > 0,
            PredictionMarketError::InsufficientBalance
        );

        // 4. 计算实际可补偿金额（取三者最小值）
        let actual_compensation = requested_compensation
            .min(global_balance)
            .min(market_contribution);

        // 5. 验证补偿后余额合法
        require!(
            actual_compensation <= market_contribution,
            PredictionMarketError::InvalidParameter
        );

        msg!(
            "✅ Insurance validation passed - Requested: {}, Actual: {}, Market contribution: {}, Global balance: {}",
            requested_compensation,
            actual_compensation,
            market_contribution,
            global_balance
        );

        Ok(actual_compensation)
    }

    /// 执行保险池补偿（更新账本）
    ///
    /// # 参数
    /// * `global_config` - 全局配置（可变，更新全局余额）
    /// * `market` - 市场账户（可变，更新市场贡献额）
    /// * `compensation_amount` - 补偿金额（必须已通过 validate_compensation 验证）
    ///
    /// # 返回
    /// * `Result<()>` - 操作结果
    ///
    /// # 注意
    /// 此函数只更新账本，不执行实际的 USDC 转账
    /// 调用者需要在调用此函数后执行 token::transfer
    pub fn apply_compensation(
        global_config: &mut Config,
        market: &mut Market,
        compensation_amount: u64,
    ) -> Result<()> {
        // 1. 扣除全局保险池余额
        global_config.lp_insurance_pool_balance = global_config
            .lp_insurance_pool_balance
            .checked_sub(compensation_amount)
            .ok_or(PredictionMarketError::MathOverflow)?;

        // 2. 扣除市场级贡献额
        market.insurance_pool_contribution = market
            .insurance_pool_contribution
            .checked_sub(compensation_amount)
            .ok_or(PredictionMarketError::MathOverflow)?;

        msg!(
            "✅ Insurance compensation applied - Amount: {}, Remaining global: {}, Remaining market: {}",
            compensation_amount,
            global_config.lp_insurance_pool_balance,
            market.insurance_pool_contribution
        );

        Ok(())
    }

    /// 计算 LP 损失率（基点）
    ///
    /// # 参数
    /// * `invested_usdc` - LP 投入的 USDC 总额
    /// * `withdrawn_usdc` - LP 撤出时获得的 USDC 总额
    ///
    /// # 返回
    /// * `u16` - 损失率（基点，0-10000）
    ///
    /// # 示例
    /// - 投入 10000 USDC，撤出 8500 USDC → 损失率 1500 bps (15%)
    /// - 投入 10000 USDC，撤出 10500 USDC → 损失率 0 bps (盈利，无损失)
    pub fn calculate_loss_rate(invested_usdc: u64, withdrawn_usdc: u64) -> u16 {
        if withdrawn_usdc >= invested_usdc {
            // 盈利或持平，无损失
            return 0;
        }

        let loss = invested_usdc.saturating_sub(withdrawn_usdc);
        let loss_rate = ((loss as u128)
            .saturating_mul(crate::constants::BASIS_POINTS_DIVISOR as u128)
            / (invested_usdc as u128)) as u16;

        loss_rate.min(10000) // 最大 100%
    }

    /// 计算保险池补偿金额
    ///
    /// # 参数
    /// * `global_config` - 全局配置（包含补偿参数）
    /// * `invested_usdc` - LP 投入的 USDC 总额
    /// * `withdrawn_usdc` - LP 撤出时获得的 USDC 总额
    ///
    /// # 返回
    /// * `u64` - 应补偿的金额（0 表示不触发补偿）
    ///
    /// # 补偿规则
    /// 1. 计算损失率：(invested - withdrawn) / invested
    /// 2. 如果损失率 < insurance_loss_threshold_bps，不补偿
    /// 3. 如果损失率 >= 阈值，补偿 = 损失 × insurance_max_compensation_bps
    ///
    /// # 示例
    /// - 阈值 10%，最大补偿 50%
    /// - 投入 10000，撤出 8500，损失 1500 (15%)
    /// - 触发补偿：1500 × 50% = 750 USDC
    pub fn calculate_compensation_amount(
        global_config: &Config,
        invested_usdc: u64,
        withdrawn_usdc: u64,
    ) -> u64 {
        // 1. 计算损失率
        let loss_rate = Self::calculate_loss_rate(invested_usdc, withdrawn_usdc);

        // 2. 检查是否触发补偿阈值
        if loss_rate < global_config.insurance_loss_threshold_bps {
            msg!(
                "✅ Insurance: Loss rate {}bps < threshold {}bps, no compensation",
                loss_rate,
                global_config.insurance_loss_threshold_bps
            );
            return 0;
        }

        // 3. 计算损失金额
        let loss_amount = invested_usdc.saturating_sub(withdrawn_usdc);

        // 4. 计算补偿金额（损失 × 最大补偿比例）
        let compensation = ((loss_amount as u128)
            .saturating_mul(global_config.insurance_max_compensation_bps as u128)
            / (crate::constants::BASIS_POINTS_DIVISOR as u128)) as u64;

        msg!(
            "✅ Insurance: Loss rate {}bps >= threshold {}bps, compensation {} USDC ({}% of {} loss)",
            loss_rate,
            global_config.insurance_loss_threshold_bps,
            compensation,
            global_config.insurance_max_compensation_bps / 100,
            loss_amount
        );

        compensation
    }

    /// 检查市场是否有足够的保险池贡献额
    ///
    /// # 参数
    /// * `market` - 市场账户
    /// * `required_amount` - 需要的金额
    ///
    /// # 返回
    /// * `bool` - true 表示足够，false 表示不足
    pub fn has_sufficient_market_contribution(market: &Market, required_amount: u64) -> bool {
        market.insurance_pool_contribution >= required_amount
    }

    /// 获取市场可用的保险池余额
    ///
    /// # 参数
    /// * `global_config` - 全局配置
    /// * `market` - 市场账户
    ///
    /// # 返回
    /// * `u64` - 该市场可用的保险池余额（取全局余额和市场贡献额的最小值）
    pub fn get_available_balance(global_config: &Config, market: &Market) -> u64 {
        global_config
            .lp_insurance_pool_balance
            .min(market.insurance_pool_contribution)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_calculate_loss_rate() {
        // 无损失
        assert_eq!(InsurancePoolValidator::calculate_loss_rate(10000, 10000), 0);
        assert_eq!(InsurancePoolValidator::calculate_loss_rate(10000, 11000), 0);

        // 10% 损失
        assert_eq!(InsurancePoolValidator::calculate_loss_rate(10000, 9000), 1000);

        // 50% 损失
        assert_eq!(InsurancePoolValidator::calculate_loss_rate(10000, 5000), 5000);

        // 100% 损失
        assert_eq!(InsurancePoolValidator::calculate_loss_rate(10000, 0), 10000);
    }

    #[test]
    fn test_calculate_compensation_amount() {
        let mut config = Config {
            authority: Pubkey::default(),
            pending_authority: Pubkey::default(),
            team_wallet: Pubkey::default(),
            platform_buy_fee: 0,
            platform_sell_fee: 0,
            lp_buy_fee: 0,
            lp_sell_fee: 0,
            token_supply_config: 0,
            token_decimals_config: 6,
            initial_real_token_reserves_config: 0,
            min_sol_liquidity: 0,
            min_trading_liquidity: 0,
            initialized: true,
            is_paused: false,
            whitelist_enabled: false,
            usdc_mint: Pubkey::default(),
            usdc_vault_min_balance: 0,
            min_usdc_liquidity: 0,
            lp_insurance_pool_balance: 100000,
            lp_insurance_allocation_bps: 2000,
            insurance_loss_threshold_bps: 1000, // 10%
            insurance_max_compensation_bps: 5000, // 50%
            insurance_pool_enabled: true,
        };

        // 损失率 5% < 阈值 10%，不补偿
        assert_eq!(
            InsurancePoolValidator::calculate_compensation_amount(&config, 10000, 9500),
            0
        );

        // 损失率 15% >= 阈值 10%，补偿 1500 × 50% = 750
        assert_eq!(
            InsurancePoolValidator::calculate_compensation_amount(&config, 10000, 8500),
            750
        );

        // 损失率 50%，补偿 5000 × 50% = 2500
        assert_eq!(
            InsurancePoolValidator::calculate_compensation_amount(&config, 10000, 5000),
            2500
        );
    }
}
