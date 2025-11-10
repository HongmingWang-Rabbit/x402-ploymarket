//! # Solana 预测市场合约主程序
//! 
//! 这是一个基于Solana区块链的去中心化预测市场平台，灵感来源于Polymarket。
//! 该平台允许用户创建市场、交易头寸，并根据现实世界事件解决结果。
//! 
//! ## 主要功能
//! - 创建预测市场
//! - 买卖YES/NO代币
//! - 流动性管理
//! - 市场结算
//! - 权限管理

use anchor_lang::prelude::*;

// ✅ v3.0.6: Gas 优化宏 - 条件编译日志
// 生产模式: msg!() 不执行,节省约 3,000-5,000 CU/tx
// 开发模式: 启用 --features verbose-logs
#[macro_export]
macro_rules! log_info {
    ($($arg:tt)*) => {
        #[cfg(feature = "verbose-logs")]
        msg!($($arg)*)
    };
}

// 模块声明
pub mod constants;  // 常量定义
pub mod errors;     // 错误类型定义
pub mod events;     // 事件定义
pub mod instructions; // 指令实现
pub mod math;       // 数学库（定点数、LMSR）
pub mod state;      // 状态结构定义
pub mod types;      // 类型定义（枚举等）✅ v1.6.0: 替代魔法数字
pub mod utils;      // 工具函数
pub mod insurance;  // ✅ v3.2.0: 保险池资金隔离验证模块

// 导入指令模块
#[allow(ambiguous_glob_imports)]
use instructions::{
    accept_authority::*, add_liquidity::*, add_to_whitelist::*, claim_fees_preview::*, claim_lp_fees::*, claim_rewards::*, claim_rewards_preview::*,
    configure::*, create_market::*, emergency_pause::*, emergency_unpause::*, ensure_team_usdc_ata::*, configure_market_fees::*, mint_complete_set::*, mint_no_token::*, nominate_authority::*,
    pause::*, reclaim_dust::*, redeem_complete_set::*, remove_from_whitelist::*, reset_circuit_breaker::*,
    resolution::*, seed_pool::*, sell_preview::*, set_mint_authority::*, settle_pool::*, swap::*, update_market_name::*,
    withdraw_liquidity::*, withdraw_preview::*, pause_market::*,
};

// 导入状态模块
use state::config::*;
use state::market::*;

// 声明程序ID
// Localhost: G9h26GViC3ma7Zg58HAbLaqEXgYEWLCCiNjfWkooevq2
// Devnet: CzddKJkrkAAsECFhEA1KzNpL7RdrZ6PYG7WEkNRrXWgM
declare_id!("CzddKJkrkAAsECFhEA1KzNpL7RdrZ6PYG7WEkNRrXWgM");

/// 预测市场程序主模块
#[program]
pub mod prediction_market {
    use super::*;

    /// 配置全局设置
    /// 
    /// 由管理员调用，用于设置全局配置参数
    /// 需要验证调用者是否为授权管理员
    /// 
    /// # 参数
    /// * `ctx` - 指令上下文
    /// * `new_config` - 新的配置参数
    /// 
    /// # 返回
    /// * `Result<()>` - 操作结果
    pub fn configure(ctx: Context<Configure>, new_config: Config) -> Result<()> {
        msg!("configure: {:#?}", new_config);
        ctx.accounts.handler(new_config, ctx.bumps.config, ctx.bumps.global_vault)
    }

    /// 提名新的管理员
    /// 
    /// 当前管理员可以将管理员角色转移给其他账户
    /// 这是一个两步过程，需要新管理员接受才能完成转移
    /// 
    /// # 参数
    /// * `ctx` - 指令上下文
    /// * `new_admin` - 新管理员的公钥
    /// 
    /// # 返回
    /// * `Result<()>` - 操作结果
    pub fn nominate_authority(ctx: Context<NominateAuthority>, new_admin: Pubkey) -> Result<()> {
        ctx.accounts.process(new_admin)
    }

    /// 接受管理员角色
    /// 
    /// 被提名的管理员调用此函数来接受管理员角色
    /// 只有在被提名后才能调用此函数
    /// 
    /// # 参数
    /// * `ctx` - 指令上下文
    /// 
    /// # 返回
    /// * `Result<()>` - 操作结果
    pub fn accept_authority(ctx: Context<AcceptAuthority>) -> Result<()> {
        ctx.accounts.process()
    }

    /// 铸造NO代币
    /// 
    /// 为预测市场创建NO代币（表示"不同意"的代币）
    /// 每个市场都需要一对YES和NO代币
    /// 
    /// # 参数
    /// * `ctx` - 指令上下文
    /// * `no_symbol` - NO代币的符号
    /// * `no_uri` - NO代币的元数据URI
    /// 
    /// # 返回
    /// * `Result<()>` - 操作结果
    pub fn mint_no_token(
        ctx: Context<MintNoToken>,
        no_symbol: String,
        no_uri: String,
    ) -> Result<()> {
        ctx.accounts
            .handler(no_symbol, no_uri, ctx.bumps.global_vault)
    }

    /// 创建预测市场
    /// 
    /// 创建一个新的预测市场，包括YES代币的铸造
    /// 市场创建者需要提供市场的基本信息
    /// 
    /// # 参数
    /// * `ctx` - 指令上下文
    /// * `params` - 创建市场的参数
    /// 
    /// # 返回
    /// * `Result<()>` - 操作结果
    pub fn create_market(ctx: Context<CreateMarket>, params: CreateMarketParams) -> Result<()> {
        ctx.accounts.handler(params, ctx.bumps.global_vault)
    }

    /// 交易代币
    /// 
    /// 在预测市场中买卖YES或NO代币
    /// 使用AMM（自动做市商）机制进行价格发现
    /// 
    /// # 参数
    /// * `ctx` - 指令上下文
    /// * `amount` - 交易数量
    /// * `direction` - 交易方向（0=买入，1=卖出）
    /// * `token_type` - 代币类型（0=NO，1=YES）
    /// * `minimum_receive_amount` - 最小接收数量（滑点保护）
    /// * `deadline` - 交易截止时间戳（Unix timestamp），设为 0 则不检查
    ///
    /// # 返回
    /// * `Result<()>` - 操作结果
    pub fn swap(
        ctx: Context<Swap>,
        amount: u64,
        direction: u8,
        token_type: u8,
        minimum_receive_amount: u64,
        deadline: i64,
    ) -> Result<()> {
        ctx.accounts.handler(
            amount,
            direction,
            token_type,
            minimum_receive_amount,
            deadline,
            ctx.bumps.global_vault,
            ctx.bumps.market_usdc_vault,
        )
    }

    /// 市场结算
    /// 
    /// 由管理员调用，用于结算预测市场的结果
    /// 根据实际结果分配奖励给持有正确代币的用户
    /// 
    /// # 参数
    /// * `ctx` - 指令上下文
    /// * `yes_amount` - YES代币的奖励数量
    /// * `no_amount` - NO代币的奖励数量
    /// * `token_type` - 获胜的代币类型
    /// * `is_completed` - 市场是否完成
    /// 
    /// # 返回
    /// * `Result<()>` - 操作结果
    pub fn resolution(
        ctx: Context<Resolution>,
        yes_amount: u64,
        no_amount: u64,
        token_type: u8,
        is_completed: bool,
    ) -> Result<()> {
        ctx.accounts.handler(
            yes_amount,
            no_amount,
            token_type,
            is_completed,
            ctx.bumps.global_vault,
        )
    }

    /// 添加流动性（✅ v3.0: 单币LP - 用户只提供USDC）
    ///
    /// ✅ v3.0: 单币LP系统
    /// 用户只需提供 USDC，合约内部自动铸造 YES + NO 代币并添加到池子
    /// - 首次LP：50/50 分配（铸造完整集 + 直接添加USDC）
    /// - 后续LP：Uniswap-style 等比例添加
    ///
    /// # 参数
    /// * `ctx` - 指令上下文
    /// * `usdc_amount` - 添加的 USDC 数量
    ///
    /// # 返回
    /// * `Result<()>` - 操作结果
    ///
    /// # 前置条件
    /// - 必须先调用 set_mint_authority 将 YES/NO mint 权限转移给 market PDA
    pub fn add_liquidity(
        ctx: Context<AddLiquidity>,
        usdc_amount: u64,
    ) -> Result<()> {
        instructions::add_liquidity::handler(ctx, usdc_amount)
    }

    /// 提取流动性（✅ v3.0: 单币LP - 用户只收到USDC）
    ///
    /// ✅ v3.0: 单币LP系统
    /// LP 赎回份额，只收到 USDC（合约内部配对赎回 + 内部交换）
    /// - 配对赎回：min(YES, NO) → USDC
    /// - 内部交换：剩余单边代币卖回池子（无手续费）
    ///
    /// # 四层 LP 保护
    /// 1. 硬上限（2b）：swap 中限制价格到 88%
    /// 2. 动态撤出限额：根据失衡度限制单次撤出（5%-30%）
    /// 3. 时间锁 + 早退惩罚：持有时长 < 30天收取 0%-3% 惩罚费
    /// 4. 熔断器：极端失衡时暂停所有 LP 撤出
    ///
    /// # 参数
    /// * `ctx` - 指令上下文
    /// * `lp_shares` - 要赎回的 LP 份额数量
    /// * `min_usdc_out` - 最小接收 USDC 数量（滑点保护）
    ///
    /// # 返回
    /// * `Result<()>` - 操作结果
    pub fn withdraw_liquidity(
        ctx: Context<WithdrawLiquidity>,
        lp_shares: u64,
        min_usdc_out: u64,
    ) -> Result<()> {
        instructions::withdraw_liquidity::handler(ctx, lp_shares, min_usdc_out)
    }

    /// 铸造完整集合（条件代币核心功能）
    ///
    /// 用户存入 USDC，获得等量的 YES + NO 代币
    /// 这是 Polymarket 条件代币机制的核心：1 USDC = 1 YES + 1 NO
    ///
    /// # 参数
    /// * `ctx` - 指令上下文
    /// * `amount` - USDC 数量
    ///
    /// # 返回
    /// * `Result<()>` - 操作结果
    ///
    /// # 示例
    /// 用户存入 1 USDC → 获得 1 YES + 1 NO
    /// 这确保了 YES + NO 的价值等于抵押品
    pub fn mint_complete_set(ctx: Context<MintCompleteSet>, amount: u64) -> Result<()> {
        ctx.accounts.handler(amount, ctx.bumps.global_vault, ctx.bumps.market)
    }

    /// 赎回完整集合（条件代币核心功能）
    ///
    /// 用户销毁等量的 YES + NO 代币，赎回 USDC
    /// 与 mint_complete_set 相反的操作
    ///
    /// # 参数
    /// * `ctx` - 指令上下文
    /// * `amount` - 赎回数量
    /// * `global_vault_bump` - 全局金库 PDA bump（用于代币销毁）
    /// * `market_usdc_vault_bump` - 🔒 v1.2.7: 市场专用金库 PDA bump（用于 USDC 转账）
    ///
    /// # 返回
    /// * `Result<()>` - 操作结果
    ///
    /// # 示例
    /// 用户提供 1 YES + 1 NO → 赎回 1 USDC
    /// 这是套利者平衡市场价格的关键机制
    /// 🔒 v1.2.7: USDC 从市场专用金库支付
    pub fn redeem_complete_set(
        ctx: Context<RedeemCompleteSet>,
        amount: u64,
        market_usdc_vault_bump: u8,
    ) -> Result<()> {
        ctx.accounts.handler(amount, market_usdc_vault_bump)
    }

    /// 暂停合约
    ///
    /// 管理员调用以紧急暂停所有市场操作
    ///
    /// # 参数
    /// * `ctx` - 指令上下文
    ///
    /// # 返回
    /// * `Result<()>` - 操作结果
    pub fn pause(ctx: Context<Pause>) -> Result<()> {
        ctx.accounts.pause()
    }

    /// ✅ v3.0.2: 紧急暂停所有操作
    ///
    /// 管理员调用以立即暂停所有关键操作（swap, add_liquidity, withdraw_liquidity）
    /// 用于应对发现的严重漏洞或异常活动
    ///
    /// # 参数
    /// * `ctx` - 指令上下文
    /// * `reason` - 暂停原因（最多200字符）
    ///
    /// # 返回
    /// * `Result<()>` - 操作结果
    pub fn emergency_pause(ctx: Context<EmergencyPause>, reason: String) -> Result<()> {
        instructions::admin::emergency_pause::handler(ctx, reason)
    }

    /// ✅ v3.0.2: 恢复系统运行
    ///
    /// 管理员在修复问题后调用以恢复所有操作
    ///
    /// # 参数
    /// * `ctx` - 指令上下文
    /// * `message` - 恢复消息（最多200字符）
    ///
    /// # 返回
    /// * `Result<()>` - 操作结果
    pub fn emergency_unpause(ctx: Context<EmergencyUnpause>, message: String) -> Result<()> {
        instructions::admin::emergency_unpause::handler(ctx, message)
    }

    /// 恢复合约
    ///
    /// 管理员调用以恢复合约操作
    ///
    /// # 参数
    /// * `ctx` - 指令上下文
    ///
    /// # 返回
    /// * `Result<()>` - 操作结果
    pub fn unpause(ctx: Context<Pause>) -> Result<()> {
        ctx.accounts.unpause()
    }

    /// 添加创建者到白名单
    ///
    /// ✅ v1.0.16: 新增白名单管理指令
    /// 管理员调用以将创建者地址添加到白名单
    /// 只有在 whitelist_enabled=true 时才需要白名单
    ///
    /// # 参数
    /// * `ctx` - 指令上下文
    /// * `creator` - 要添加到白名单的创建者公钥
    ///
    /// # 返回
    /// * `Result<()>` - 操作结果
    pub fn add_to_whitelist(ctx: Context<AddToWhitelist>, creator: Pubkey) -> Result<()> {
        ctx.accounts.handler(creator)
    }

    /// 从白名单移除创建者
    ///
    /// ✅ v1.0.16: 新增白名单管理指令
    /// 管理员调用以从白名单移除创建者地址
    /// 移除后该创建者将无法创建新市场（如果 whitelist_enabled=true）
    ///
    /// # 参数
    /// * `ctx` - 指令上下文
    /// * `creator` - 要从白名单移除的创建者公钥
    ///
    /// # 返回
    /// * `Result<()>` - 操作结果
    pub fn remove_from_whitelist(ctx: Context<RemoveFromWhitelist>, creator: Pubkey) -> Result<()> {
        ctx.accounts.handler(creator)
    }

    /// 领取奖励
    ///
    /// 用户在市场结算后调用，根据 resolution 比例领取奖励
    ///
    /// # 参数
    /// * `ctx` - 指令上下文
    /// * `global_vault_bump` - 全局金库 bump
    ///
    /// # 返回
    /// * `Result<()>` - 操作结果
    ///
    /// # 示例
    /// 市场结算后，YES获胜(100%)，用户持有10 YES → 获得10 USDC
    /// 如果是平局(50%/50%)，用户持有10 YES + 10 NO → 获得10 USDC
    pub fn claim_rewards(ctx: Context<ClaimRewards>, global_vault_bump: u8) -> Result<()> {
        ctx.accounts.handler(global_vault_bump, ctx.bumps.market_usdc_vault)
    }

    /// ✅ v3.1.4: 领取奖励预览（只读）
    ///
    /// 帮助用户在 claim_rewards 前检查：
    /// - 是否有足够的 YES/NO 代币可以领取
    /// - 预期的奖励金额
    /// - 市场 USDC 金库是否有足够余额
    ///
    /// 这是一个纯查询操作，不修改任何状态
    pub fn claim_rewards_preview(ctx: Context<ClaimRewardsPreview>) -> Result<()> {
        ctx.accounts.handler()
    }

    /// Pool 初始化
    ///
    /// ✅ 双账本系统：只操作 Pool Ledger
    /// 为新创建的市场注入初始流动性，解决"鸡蛋问题"
    /// - 自动铸造 YES + NO 代币到 Pool
    /// - 初始化 LMSR 参数
    /// - 可选给种子提供者铸造 LP 份额
    ///
    /// # 参数
    /// * `ctx` - 指令上下文
    /// * `usdc_amount` - 注入的 USDC 数量
    /// * `issue_lp_shares` - 是否给种子提供者铸造 LP 份额
    /// * `global_vault_bump` - 全局金库 PDA bump
    ///
    /// # 返回
    /// * `Result<()>` - 操作结果
    ///
    /// # 注意
    /// - 只能由管理员或市场创建者调用
    /// - 每个市场只能调用一次
    pub fn seed_pool(
        ctx: Context<SeedPool>,
        usdc_amount: u64,
        issue_lp_shares: bool,
        global_vault_bump: u8,
        market_usdc_vault_bump: u8,  // 🔒 v1.2.7: 添加市场专用金库 bump
    ) -> Result<()> {
        ctx.accounts
            .handler(usdc_amount, issue_lp_shares, global_vault_bump, ctx.bumps.market, market_usdc_vault_bump)
    }

    /// Pool 结算
    ///
    /// ✅ 双账本系统：只操作 Pool Ledger
    /// 市场结束后，处理 Pool 中剩余的代币资产
    /// - 获胜方代币：保留给 LP 提取
    /// - 失败方代币：转移给团队钱包
    /// - USDC 储备：保留给 LP 提取
    ///
    /// # 参数
    /// * `ctx` - 指令上下文
    /// * `global_vault_bump` - 全局金库 PDA bump
    ///
    /// # 返回
    /// * `Result<()>` - 操作结果
    ///
    /// # 注意
    /// - 只能由管理员在市场结束后调用
    /// - LP 仍可通过 withdraw_liquidity 提取剩余资产
    pub fn settle_pool(ctx: Context<SettlePool>, global_vault_bump: u8) -> Result<()> {
        ctx.accounts.handler(global_vault_bump)
    }

    /// LP 费用领取
    ///
    /// ✅ 双账本系统：只操作 Pool Ledger
    /// 🔒 v1.2.7: 使用市场专用金库支付费用（修复金库不一致问题）
    /// LP 按比例领取累积的交易手续费
    /// - 手续费来自 swap 交易中收取的 LP 费用部分
    /// - 按 LP 份额占比分配
    /// - 更新 last_fee_claim_slot 防止重复领取
    ///
    /// # 参数
    /// * `ctx` - 指令上下文
    /// * `market_usdc_vault_bump` - 市场专用金库 PDA bump
    ///
    /// # 返回
    /// * `Result<()>` - 操作结果
    ///
    /// # 注意
    /// - LP 可随时领取累积的手续费
    /// - 手续费从 accumulated_lp_fees 中扣除
    /// - 建议定期领取，避免累积过多
    pub fn claim_lp_fees(ctx: Context<ClaimLpFees>, market_usdc_vault_bump: u8) -> Result<()> {
        ctx.accounts.handler(market_usdc_vault_bump)
    }

    /// 更新市场显示名称
    ///
    /// ✅ v1.2.0: 仅市场创建者可以更新市场的显示名称
    /// 用于修改市场在前端的显示名称，不影响市场的核心逻辑
    ///
    /// # 参数
    /// * `ctx` - 指令上下文
    /// * `new_name` - 新的显示名称（最大64字符）
    ///
    /// # 返回
    /// * `Result<()>` - 操作结果
    ///
    /// # 权限
    /// - 只有市场创建者可以调用此指令
    ///
    /// # 验证
    /// - 新名称长度必须在 1-64 字符之间
    /// - 调用者必须是市场的创建者
    pub fn update_market_name(ctx: Context<UpdateMarketName>, new_name: String) -> Result<()> {
        ctx.accounts.handler(new_name)
    }

    /// 确保团队 USDC ATA 存在（若无则创建）
    ///
    /// 仅管理员可调用；用于部署/运维阶段保障团队费用接收账户存在，避免交易失败
    pub fn ensure_team_usdc_ata(ctx: Context<EnsureTeamUsdcAta>) -> Result<()> {
        ctx.accounts.handler()
    }

    /// 配置市场级费率覆盖（管理员）
    pub fn configure_market_fees(
        ctx: Context<ConfigureMarketFees>,
        params: MarketFeeOverrideParams,
    ) -> Result<()> {
        ctx.accounts.handler(params)
    }

    /// 回收市场尾款
    ///
    /// 🔒 v1.2.7: 管理员在市场完全结束后回收市场专用金库的剩余尾款
    ///
    /// # 参数
    /// * `ctx` - 指令上下文
    /// * `market_usdc_vault_bump` - 🔒 v1.2.7: 市场专用金库 PDA bump
    ///
    /// # 安全检查
    /// - 仅管理员可调用
    /// - 市场必须已结算 (pool_settled = true)
    /// - 所有抵押品已被领取 (total_collateral_locked = 0)
    /// - 所有LP份额已提取 (total_lp_shares = 0)
    /// - 账本余额已清零 (pool_collateral_reserve = 0, accumulated_lp_fees = 0)
    ///
    /// # 返回
    /// * `Result<()>` - 操作结果
    ///
    /// # 示例
    /// 🔒 v1.2.7: 从该市场的专用金库回收全部剩余余额（通常为精度误差导致的尾款）
    /// 例如：market_usdc_ata 剩余 100 lamports（由于精度误差），全部回收到团队钱包
    pub fn reclaim_dust(ctx: Context<ReclaimDust>, market_usdc_vault_bump: u8) -> Result<()> {
        ctx.accounts.handler(market_usdc_vault_bump)
    }

    /// 转移 Mint 权限到 Market PDA（✅ v3.0: 单币LP前置步骤）
    ///
    /// ✅ v3.0: 单币LP系统
    /// 将 YES/NO 代币的 mint 权限从 global_vault 转移给 market PDA
    /// - create_market 时，mint authority 必须是 global_vault（因为 market PDA 地址依赖 yes_token.key()）
    /// - 单币LP需要 market PDA 作为 mint authority 来内部铸造代币
    /// - 因此需要两步：1) create_market 2) set_mint_authority
    ///
    /// # 参数
    /// * `ctx` - 指令上下文
    ///
    /// # 返回
    /// * `Result<()>` - 操作结果
    ///
    /// # 调用时机
    /// - 在 create_market 之后立即调用
    /// - 前端可以将两个指令原子化打包在一个 Transaction 中
    pub fn set_mint_authority(ctx: Context<SetMintAuthority>) -> Result<()> {
        instructions::set_mint_authority::handler(ctx)
    }

    /// 重置熔断器（✅ v3.0: LP保护机制）
    ///
    /// ✅ v3.0: 四层LP保护
    /// 管理员在池子恢复平衡后重置熔断器，允许 LP 继续撤出流动性
    ///
    /// # 重置条件
    /// 1. 熔断器当前处于激活状态
    /// 2. 已过 24 小时冷却期
    /// 3. 池子比例恢复到 < 3:1
    ///
    /// # 参数
    /// * `ctx` - 指令上下文
    ///
    /// # 返回
    /// * `Result<()>` - 操作结果
    ///
    /// # 权限
    /// - 仅管理员可调用
    pub fn reset_circuit_breaker(ctx: Context<ResetCircuitBreaker>) -> Result<()> {
        instructions::reset_circuit_breaker::handler(ctx)
    }

    /// 撤出流动性预览（✅ v3.0: 只读预览）
    ///
    /// ✅ v3.0: 单币LP系统
    /// 前端调用此只读指令预览 LP 撤出结果，帮助用户理解惩罚和限制
    ///
    /// # 返回信息
    /// - estimated_usdc_out: 预估 USDC 净额
    /// - early_exit_penalty: 早退惩罚金额和费率
    /// - max_withdraw_bps/shares: 动态撤出限额
    /// - circuit_breaker_active: 熔断器状态
    /// - pool_imbalance_ratio: 池子失衡度
    /// - insurance_compensation: 保险池补偿估算
    ///
    /// # 参数
    /// * `ctx` - 指令上下文
    /// * `lp_shares` - 要赎回的 LP 份额数量
    ///
    /// # 返回
    /// * `Result<WithdrawPreviewResult>` - 预览结果
    pub fn withdraw_preview(ctx: Context<WithdrawPreview>, lp_shares: u64) -> Result<WithdrawPreviewResult> {
        instructions::withdraw_preview::handler(ctx, lp_shares)
    }

    /// 卖出预览（✅ v3.1.1: 只读预览）
    ///
    /// 前端调用此只读指令，预览卖出给定数量 YES/NO 可获得的 USDC、费用拆分、
    /// 以及是否会触发最小余额保护（避免失败交易）。
    pub fn sell_preview(
        ctx: Context<SellPreview>,
        token_amount: u64,
        token_type: u8,
    ) -> Result<SellPreviewResult> {
        instructions::sell_preview::handler(ctx, token_amount, token_type)
    }

    /// LP 手续费领取预览（✅ v3.1.1: 只读）
    ///
    /// 返回 LP 当前可领取手续费与最小余额保护的预计结果
    pub fn claim_fees_preview(
        ctx: Context<ClaimFeesPreview>,
    ) -> Result<ClaimFeesPreviewResult> {
        instructions::claim_fees_preview::handler(ctx)
    }

    /// 市场级暂停（管理员）
    pub fn pause_market(mut ctx: Context<PauseMarket>) -> Result<()> {
        instructions::pause_market::PauseMarket::pause(&mut ctx.accounts)
    }

    /// 市场级恢复（管理员）
    pub fn unpause_market(mut ctx: Context<PauseMarket>) -> Result<()> {
        instructions::pause_market::PauseMarket::unpause(&mut ctx.accounts)
    }
}
