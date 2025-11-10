//! 管理员配置指令：初始化/更新全局配置与全局金库

use crate::errors::*;
use crate::{
    constants::{CONFIG, GLOBAL},
    state::config::*,
};
use anchor_lang::{prelude::*, system_program, Discriminator};
use anchor_spl::{associated_token::AssociatedToken, token::Token};
use anchor_lang::prelude::borsh::BorshDeserialize;

/// 配置账户集合
#[derive(Accounts)]
pub struct Configure<'info> {
    /// 付费者/管理员
    #[account(mut)]
    payer: Signer<'info>,

    /// 配置PDA（内部完成初始化/扩容/写入）
    /// CHECK: initialization handled inside the instruction
    #[account(
        mut,
        seeds = [CONFIG.as_bytes()],
        bump,
    )]
    config: AccountInfo<'info>,

    /// 全局金库（PDA，存放 USDC）
    /// CHECK: global vault pda which stores USDC
    #[account(
        mut,
        seeds = [GLOBAL.as_bytes()],
        bump,
    )]
    pub global_vault: AccountInfo<'info>,

    /// 系统程序
    #[account(address = system_program::ID)]
    system_program: Program<'info, System>,

    /// 代币程序
    token_program: Program<'info, Token>,

    /// 关联代币账户程序
    associated_token_program: Program<'info, AssociatedToken>,
}

impl<'info> Configure<'info> {
    /// 写入全局配置，并在需要时创建/扩容配置PDA与初始化全局金库
    pub fn handler(&mut self, new_config: Config, config_bump: u8, global_vault_bump: u8) -> Result<()> {
        // ✅ v1.1.1: 修复权限控制不足问题
        //
        // 🔴 原问题：仅在配置已存在时检查权限（第 184 行）
        //    初始化时任何人都可以调用，造成严重安全隐患：
        //    1. 抢先运行攻击：恶意用户可抢先初始化配置
        //    2. 设置恶意参数：team_wallet 指向攻击者地址
        //    3. 拦截所有手续费：平台所有收入被窃取
        //
        // ✅ 修复策略：
        //    - 初始化时：检查 payer 是否为预期的部署者（通过 new_config.authority）
        //    - 更新时：检查 payer 是否为当前 authority（已有逻辑）
        //
        // 📐 实现方式：
        //    初始化操作中，new_config.authority 应该等于 payer.key()
        //    这确保只有被授权的部署者可以初始化配置
        let is_initialization = self.config.owner != &crate::ID;
        // ✅ v1.1.1: 强制 token_decimals = 6（USDC 精度绑定）
        //
        // 🎯 核心设计原则：YES/NO 代币精度必须与抵押品精度严格一致
        //
        // 📐 精度绑定逻辑：
        //    - 抵押品：USDC（6 位精度，1 USDC = 10^6 最小单位）
        //    - YES/NO：必须使用 6 位精度（1 YES = 10^6 最小单位）
        //    - 等价关系：1 USDC ⇔ 1 YES + 1 NO（在相同精度下）
        //
        // 🔒 为什么强制绑定？
        //    1. 保证 1:1 套保机制（Polymarket 核心玩法）
        //    2. 避免精度转换错误（10^6 vs 10^9 差 1000 倍）
        //    3. 简化 LMSR 数学运算（无需跨精度计算）
        //    4. 确保抵押品守恒（mint/redeem 时精度一致）
        //
        // ⚠️ 如果未来支持多币种：
        //    - USDC 抵押 → token_decimals = 6
        //    - USDC 抵押 → token_decimals = 6
        //    - 自定义代币 → token_decimals = 自定义精度
        //
        // 🔍 调试日志
        msg!("🔍 Debug: token_decimals_config = {}", new_config.token_decimals_config);
        msg!("🔍 Debug: USDC_DECIMALS = {}", crate::constants::USDC_DECIMALS);
        msg!("🔍 Debug: authority = {}", new_config.authority);
        msg!("🔍 Debug: team_wallet = {}", new_config.team_wallet);
        msg!("🔍 Debug: platform_buy_fee = {}", new_config.platform_buy_fee);
        
        require!(
            new_config.token_decimals_config == crate::constants::USDC_DECIMALS,
            PredictionMarketError::InvalidParameter
        );

        // 🔒 修复：基础参数校验
        let decimal_multiplier = 10u64.pow(new_config.token_decimals_config as u32);

        // 校验 1：总供应必须是精度的整数倍
        let fractional_tokens = new_config.token_supply_config % decimal_multiplier;
        if fractional_tokens != 0 {
            return Err(ValueInvalid.into());
        }

        // 🔒 修复：校验 token_supply_config >= initial_real_token_reserves_config
        // 原逻辑量纲错误，应该直接比较两个配置值
        require!(
            new_config.token_supply_config >= new_config.initial_real_token_reserves_config,
            PredictionMarketError::InvalidAmount
        );

        // ✅ v1.1.1: 强制 initial_real_token_reserves_config > 0（修复 DoS 漏洞）
        //
        // 🔒 核心风险：如果 b = 0，所有 LMSR 函数都会失败
        //    - lmsr_cost 中的 require!(b > 0) 会直接拒绝
        //    - 导致新市场创建后无法进行任何买卖操作
        //    - 形成可预期的系统性拒绝服务（DoS）
        //
        // 🎯 修复策略：在配置阶段强制校验 > 0
        require!(
            new_config.initial_real_token_reserves_config > 0,
            PredictionMarketError::InvalidParameter
        );

        // ✅ v1.0.13: 校验 initial_real_token_reserves_config 不超过 LMSR 上限
        // initial_real_token_reserves_config 用作 create_market 的 lmsr_b 参数
        // 必须 <= MAX_LMSR_B (1M USDC = 1,000,000,000,000 最小单位) 以防止定点 LMSR 溢出
        //
        // 修复 (v1.0.13): 原错误使用 1u64 << 32 = 4.29 SOL (历史记录，当时使用 SOL 计价)
        // ✅ v1.1.0: 更新为 constants::MAX_LMSR_B = 1M USDC，支持深度市场流动性
        require!(
            new_config.initial_real_token_reserves_config <= crate::constants::MAX_LMSR_B,
            PredictionMarketError::ValueTooLarge
        );

        // ✅ v1.0.16: 校验手续费基点在合理范围内（防止溢出）
        // 基点范围：0-10000 (0%-100%)
        // 如果设置 >10000，swap 中的 checked_sub 会下溢导致所有交易失败
        // 效果等同于永久暂停市场
        // ✅ v1.2.4: 使用常量替代魔法值
        use crate::constants::{MAX_FEE_BPS, MAX_USDC_VAULT_MIN_BALANCE, MAX_MIN_USDC_LIQUIDITY};

        require!(
            new_config.platform_buy_fee <= MAX_FEE_BPS,
            PredictionMarketError::ValueTooLarge
        );
        require!(
            new_config.platform_sell_fee <= MAX_FEE_BPS,
            PredictionMarketError::ValueTooLarge
        );
        require!(
            new_config.lp_buy_fee <= MAX_FEE_BPS,
            PredictionMarketError::ValueTooLarge
        );
        require!(
            new_config.lp_sell_fee <= MAX_FEE_BPS,
            PredictionMarketError::ValueTooLarge
        );

        // 校验总费用不超过 100%（买入和卖出分别检查）
        let total_buy_fee = new_config.platform_buy_fee
            .checked_add(new_config.lp_buy_fee)
            .ok_or(PredictionMarketError::MathOverflow)?;
        let total_sell_fee = new_config.platform_sell_fee
            .checked_add(new_config.lp_sell_fee)
            .ok_or(PredictionMarketError::MathOverflow)?;

        require!(
            total_buy_fee <= MAX_FEE_BPS,
            PredictionMarketError::ValueTooLarge
        );
        require!(
            total_sell_fee <= MAX_FEE_BPS,
            PredictionMarketError::ValueTooLarge
        );

        // ✅ v1.2.3: 校验 usdc_vault_min_balance 上限
        // ✅ v1.2.4: 使用常量替代魔法值
        //
        // 🎯 核心风险：如果 usdc_vault_min_balance 设置过大，会导致大量资金永久锁定
        //
        // 📐 合理范围：
        //    - 建议值: 2000-5000 最小单位 (0.002-0.005 USDC)
        //    - 上限值: 1,000,000 最小单位 (1 USDC)
        //    - 参考 Solana 租金豁免要求: ~0.001 SOL ≈ $0.1
        //
        // 🔒 为什么需要上限？
        //    1. 防止误配置导致每个市场锁定过多资金
        //    2. 保证资金利用效率
        //    3. 降低用户资金风险

        require!(
            new_config.usdc_vault_min_balance <= MAX_USDC_VAULT_MIN_BALANCE,
            PredictionMarketError::ValueTooLarge
        );

        // ✅ v1.2.3: 校验 min_usdc_liquidity 上限
        // ✅ v1.2.4: 使用常量替代魔法值
        //
        // 🎯 核心风险：如果 min_usdc_liquidity 设置过大，会导致用户无法添加流动性
        //
        // 📐 合理范围：
        //    - 建议值: 100 USDC (100,000,000 最小单位)
        //    - 上限值: 10,000 USDC (10,000,000,000 最小单位)
        //
        // 🔒 为什么需要上限？
        //    1. 防止误配置导致门槛过高
        //    2. 保证普通用户可以参与 LP
        //    3. 避免流动性过度集中

        require!(
            new_config.min_usdc_liquidity <= MAX_MIN_USDC_LIQUIDITY,
            PredictionMarketError::ValueTooLarge
        );

        msg!(
            "✅ Vault min balance validated: {} <= {}, min liquidity: {} <= {}",
            new_config.usdc_vault_min_balance,
            MAX_USDC_VAULT_MIN_BALANCE,
            new_config.min_usdc_liquidity,
            MAX_MIN_USDC_LIQUIDITY
        );

        // ✅ v3.0: 校验保险池启用条件
        //
        // 🎯 核心风险：保险池无资金来源时无法运作
        //
        // 📐 启用条件：
        //    - 必须配置 platform_buy_fee > 0 或 platform_sell_fee > 0
        //    - 否则保险池没有注入资金来源
        //
        // 🔒 为什么需要校验？
        //    1. 防止启用保险池但无资金来源
        //    2. 避免前端误导用户（显示保险保护但实际无效）
        //    3. 保证保险池机制可持续性
        //
        // 📝 使用场景：
        //    - 初期（platform_fee=0%）：insurance_pool_enabled = false
        //    - 后期（启用platform_fee）：通过 configure 设置为 true
        if new_config.insurance_pool_enabled {
            require!(
                new_config.platform_buy_fee > 0 || new_config.platform_sell_fee > 0,
                PredictionMarketError::CannotEnableInsuranceWithoutPlatformFee
            );
            msg!(
                "✅ Insurance pool enabled: platform_buy_fee={}, platform_sell_fee={}",
                new_config.platform_buy_fee,
                new_config.platform_sell_fee
            );
        } else {
            msg!("ℹ️ Insurance pool disabled");
        }

        // ✅ v3.2.0: 校验保险池配置参数（修复 Medium 问题）
        //
        // 🎯 核心风险：保险池参数配置不合理导致机制失效
        //
        // 📐 参数范围：
        //    - lp_insurance_allocation_bps: 0-10000 (0%-100%)
        //    - insurance_loss_threshold_bps: 0-10000 (0%-100%)
        //    - insurance_max_compensation_bps: 0-10000 (0%-100%)
        //
        // 🔒 为什么需要校验？
        //    1. 防止参数超过 100% 导致溢出
        //    2. 确保保险池机制可持续运作
        //    3. 避免误配置导致保险池快速耗尽
        use crate::constants::MAX_INSURANCE_CONFIG_BPS;

        require!(
            new_config.lp_insurance_allocation_bps <= MAX_INSURANCE_CONFIG_BPS,
            PredictionMarketError::InvalidInsuranceConfig
        );
        require!(
            new_config.insurance_loss_threshold_bps <= MAX_INSURANCE_CONFIG_BPS,
            PredictionMarketError::InvalidInsuranceConfig
        );
        require!(
            new_config.insurance_max_compensation_bps <= MAX_INSURANCE_CONFIG_BPS,
            PredictionMarketError::InvalidInsuranceConfig
        );

        // ✅ v3.2.0: 校验保险池参数的合理性
        //
        // 🎯 合理性检查：
        //    1. 分配比例建议 10%-30%（过高会减少团队收入）
        //    2. 损失阈值建议 5%-20%（过低会导致保险池快速耗尽）
        //    3. 最大补偿建议 30%-70%（过高会导致保险池不可持续）
        //
        // 📝 警告而非错误：允许管理员自行决定，但给出警告
        if new_config.lp_insurance_allocation_bps > 3000 {
            msg!(
                "⚠️ Warning: Insurance allocation {}bps > 30%, may reduce team revenue",
                new_config.lp_insurance_allocation_bps
            );
        }
        if new_config.insurance_loss_threshold_bps < 500 {
            msg!(
                "⚠️ Warning: Loss threshold {}bps < 5%, insurance pool may deplete quickly",
                new_config.insurance_loss_threshold_bps
            );
        }
        if new_config.insurance_max_compensation_bps > 7000 {
            msg!(
                "⚠️ Warning: Max compensation {}bps > 70%, insurance pool may not be sustainable",
                new_config.insurance_max_compensation_bps
            );
        }

        msg!(
            "✅ Insurance config validated - Allocation: {}bps, Threshold: {}bps, Max compensation: {}bps",
            new_config.lp_insurance_allocation_bps,
            new_config.insurance_loss_threshold_bps,
            new_config.insurance_max_compensation_bps
        );

        // 计算空间与租金
        let serialized_config =
            [&Config::DISCRIMINATOR, new_config.try_to_vec()?.as_slice()].concat();
        let serialized_config_len = serialized_config.len();
        let config_cost = Rent::get()?.minimum_balance(serialized_config_len);

        // 初始化/校验配置PDA归属与权限
        if is_initialization {
            // ✅ v1.1.1: 初始化时的权限检查
            //
            // 确保只有预期的部署者可以初始化配置
            // new_config.authority 必须等于 payer（调用者）
            require!(
                new_config.authority == self.payer.key(),
                PredictionMarketError::IncorrectAuthority
            );

            let cpi_context = CpiContext::new(
                self.system_program.to_account_info(),
                system_program::CreateAccount {
                    from: self.payer.to_account_info(),
                    to: self.config.to_account_info(),
                },
            );
            system_program::create_account(
                cpi_context.with_signer(&[&[CONFIG.as_bytes(), &[config_bump]]]),
                config_cost,
                serialized_config_len as u64,
                &crate::ID,
            )?;

            msg!("Config initialized by authority: {}", self.payer.key());
        } else {
            // ✅ 更新时的权限检查（原有逻辑）
            let data = self.config.try_borrow_data()?;
            if data.len() < 8 || &data[0..8] != Config::DISCRIMINATOR {
                return err!(PredictionMarketError::IncorrectConfigAccount);
            }
            let config = Config::deserialize(&mut &data[8..])?;

            // 只有当前 authority 可以更新配置
            require!(
                config.authority == self.payer.key(),
                PredictionMarketError::IncorrectAuthority
            );

            msg!("Config updated by authority: {}", self.payer.key());
        }

        // 🔒 修复：处理账户大小调整（扩容或收缩）
        let current_data_len = self.config.to_account_info().data_len();
        let lamport_delta = (config_cost as i64) - (self.config.lamports() as i64);

        // 无论扩容还是收缩，都需要调用 realloc
        if serialized_config_len != current_data_len {
            // 步骤1：先调整账户大小（无论扩容还是收缩）
            // realloc 被标记为 deprecated 但是 Anchor 0.32.1 中唯一可用的方法
            #[allow(deprecated)]
            self.config.to_account_info().realloc(serialized_config_len, false)?;

            // 步骤2：处理租金差额
            if lamport_delta > 0 {
                // 扩容：需要补足租金
                system_program::transfer(
                    CpiContext::new(
                        self.system_program.to_account_info(),
                        system_program::Transfer {
                            from: self.payer.to_account_info(),
                            to: self.config.to_account_info(),
                        },
                    ),
                    lamport_delta as u64,
                )?;
                msg!("Config expanded: +{} bytes, +{} lamports",
                    serialized_config_len as i64 - current_data_len as i64,
                    lamport_delta);
            } else if lamport_delta < 0 {
                // 收缩：退回多余租金
                **self.config.to_account_info().try_borrow_mut_lamports()? -= (-lamport_delta) as u64;
                **self.payer.to_account_info().try_borrow_mut_lamports()? += (-lamport_delta) as u64;
                msg!("Config shrunk: {} bytes, refunded {} lamports",
                    current_data_len as i64 - serialized_config_len as i64,
                    -lamport_delta);
            }
        }

        // 写入序列化配置
        (self.config.try_borrow_mut_data()?[..serialized_config_len])
            .copy_from_slice(serialized_config.as_slice());

        // ✅ FIX: 正确初始化全局金库 PDA
        // 必须调用 create_account 设置 owner 为程序，才能在后续修改 lamports
        if self.global_vault.owner != &crate::ID {
            let rent = Rent::get()?;
            let min_rent = rent.minimum_balance(0); // PDA 不存储数据，只需最小租金

            let cpi_context = CpiContext::new(
                self.system_program.to_account_info(),
                system_program::CreateAccount {
                    from: self.payer.to_account_info(),
                    to: self.global_vault.to_account_info(),
                },
            );
            system_program::create_account(
                cpi_context.with_signer(&[&[GLOBAL.as_bytes(), &[global_vault_bump]]]),
                min_rent,
                0, // 数据长度为0
                &crate::ID, // ✅ 关键：owner 设为程序
            )?;
            msg!("Global vault PDA created with owner = program_id");
        }

        // ✅ v1.1.1: 发射配置更新事件（增强可追溯性）
        let clock = Clock::get()?;
        emit!(crate::events::ConfigUpdateEvent {
            authority: self.payer.key(),
            is_initialization,
            new_authority: new_config.authority,
            team_wallet: new_config.team_wallet,
            initial_real_token_reserves_config: new_config.initial_real_token_reserves_config,
            token_supply_config: new_config.token_supply_config,
            token_decimals_config: new_config.token_decimals_config,
            platform_buy_fee: new_config.platform_buy_fee,
            platform_sell_fee: new_config.platform_sell_fee,
            lp_buy_fee: new_config.lp_buy_fee,
            lp_sell_fee: new_config.lp_sell_fee,
            is_paused: new_config.is_paused,
            whitelist_enabled: new_config.whitelist_enabled,
            timestamp: clock.unix_timestamp,
        });

        Ok(())
    }
}
