//! 市场指令：创建市场（含YES mint、元数据、金库ATA等）

use crate::{
    constants::{CONFIG, GLOBAL, MARKET, METADATA},
    errors::*,
    events::CreateEvent,
    state::{config::*, market::*, whitelist::*},
};
use anchor_lang::{prelude::*, solana_program::sysvar::SysvarId, system_program};
use anchor_spl::{
    associated_token::{self, AssociatedToken},
    metadata::{self, Metadata},
    token::{self, Mint, Token, TokenAccount},
};

/// 账户集合：创建市场所需账户
#[derive(Accounts)]
pub struct CreateMarket<'info> {
    /// 全局配置
    #[account(
        mut,
        seeds = [CONFIG.as_bytes()],
        bump,
    )]
    global_config: Box<Account<'info, Config>>,

    /// 全局金库（PDA，存放 USDC）
    /// CHECK: global vault pda which stores USDC
    #[account(
        mut,
        seeds = [GLOBAL.as_bytes()],
        bump,
    )]
    pub global_vault: AccountInfo<'info>,

    /// 创建者
    #[account(mut)]
    creator: Signer<'info>,

    /// ✅ 白名单账户（可选，取决于 global_config.whitelist_enabled）
    /// CHECK: Validated in handler if whitelist is enabled
    #[account(
        seeds = [Whitelist::SEED_PREFIX.as_bytes(), creator.key().as_ref()],
        bump,
    )]
    creator_whitelist: Option<Account<'info, Whitelist>>,

    /// YES代币mint（由全局金库作为mint authority）
    #[account(
        init,
        payer = creator,
        mint::decimals = global_config.token_decimals_config,
        mint::authority = global_vault.key(),
    )]
    yes_token: Box<Account<'info, Mint>>,

    /// NO代币mint（需在mint_no_token指令中创建）
    /// ✅ FIX: 验证 mint authority 是全局金库，防止恶意铸造
    #[account(
        mut,
        constraint = no_token.mint_authority == anchor_lang::solana_program::program_option::COption::Some(global_vault.key())
            @ PredictionMarketError::InvalidAuthority
    )]
    pub no_token: Box<Account<'info, Mint>>,

    /// 市场账户（以YES/NO mint作为种子）
    /// 🔒 v1.2.2: 使用 Market::INIT_SPACE 正确分配空间（包含 display_name String）
    #[account(
        init,
        payer = creator,
        space = 8 + Market::INIT_SPACE,
        seeds = [MARKET.as_bytes(), &yes_token.key().to_bytes(), &no_token.key().to_bytes()],
        bump
    )]
    market: Box<Account<'info, Market>>,

    /// YES元数据账户（传递给 Metadata 程序）
    /// CHECK: passed to token metadata program
    #[account(mut,
        seeds = [
            METADATA.as_bytes(),
            metadata::ID.as_ref(),
            yes_token.key().as_ref(),
        ],
        bump,
        seeds::program = metadata::ID
    )]
    yes_token_metadata_account: UncheckedAccount<'info>,

    /// NO元数据账户（传递给 Metadata 程序）
    /// CHECK: passed to token metadata program
    #[account(
        mut,
        seeds = [
            METADATA.as_bytes(),
            metadata::ID.as_ref(),
            no_token.key().as_ref(),
        ],
        bump,
        seeds::program = metadata::ID
    )]
    no_token_metadata_account: UncheckedAccount<'info>,

    /// 全局金库的YES ATA（在指令中创建）
    /// CHECK: created in instruction
    #[account(
        mut,
        seeds = [
            global_vault.key().as_ref(),
            token::spl_token::ID.as_ref(),
            yes_token.key().as_ref(),
        ],
        bump,
        seeds::program = associated_token::ID
    )]
    global_yes_token_account: UncheckedAccount<'info>,

    /// ✅ v1.1.0: 全局金库的 NO ATA（用于铸造哨兵代币）
    /// 用于铸造 1 个最小单位的 NO 代币作为"占用标记"
    #[account(
        init_if_needed,
        payer = creator,
        associated_token::mint = no_token,
        associated_token::authority = global_vault,
    )]
    global_no_token_account: Box<Account<'info, TokenAccount>>,

    /// 系统/租金/代币/ATA/元数据程序
    #[account(address = system_program::ID)]
    system_program: Program<'info, System>,
    #[account(address = Rent::id())]
    rent: Sysvar<'info, Rent>,
    #[account(address = token::ID)]
    token_program: Program<'info, Token>,
    #[account(address = associated_token::ID)]
    associated_token_program: Program<'info, AssociatedToken>,
    #[account(address = metadata::ID)]
    mpl_token_metadata_program: Program<'info, Metadata>,

    /// 团队钱包（需与配置一致）
    /// CHECK: should be same with the address in the global_config
    #[account(
        mut,
        constraint = global_config.team_wallet == team_wallet.key() @PredictionMarketError::IncorrectAuthority
    )]
    pub team_wallet: UncheckedAccount<'info>,
}

impl<'info> CreateMarket<'info> {
    /// 处理创建市场：初始化市场状态和代币元数据
    pub fn handler(&mut self, params: CreateMarketParams, _global_vault_bump: u8) -> Result<()> {
        msg!("CreateMarket start");

        // ═══════════════════════════════════════════════════════════════
        // 🔒 v1.0.30: 暂停检查
        // ═══════════════════════════════════════════════════════════════
        require!(
            !self.global_config.is_paused,
            PredictionMarketError::ContractPaused
        );
        msg!("✅ Contract not paused, proceeding with market creation");

        // ═══════════════════════════════════════════════════════════════
        // 🔒 白名单验证（如果启用）
        // ═══════════════════════════════════════════════════════════════
        if self.global_config.whitelist_enabled {
            require!(
                self.creator_whitelist.is_some(),
                PredictionMarketError::CreatorNotWhitelisted
            );

            let whitelist = self.creator_whitelist.as_ref().unwrap();
            require!(
                whitelist.creator == self.creator.key(),
                PredictionMarketError::IncorrectAuthority
            );

            msg!("✅ Creator whitelist validated: {}", self.creator.key());
        } else {
            msg!("Whitelist validation skipped (disabled in config)");
        }

        // ═══════════════════════════════════════════════════════════════
        // 🔒 v1.0.29: NO Token 一致性校验
        // ═══════════════════════════════════════════════════════════════
        // 验证 NO token decimals 与配置一致
        require!(
            self.no_token.decimals == self.global_config.token_decimals_config,
            PredictionMarketError::InvalidParameter
        );

        // 验证 NO token freeze_authority 为 None（无冻结权限）
        // 这确保 NO token 无法被单方面冻结，保护用户资产
        require!(
            self.no_token.freeze_authority.is_none(),
            PredictionMarketError::InvalidParameter
        );

        // 🔒 v1.1.0: 对称性校验 - YES token 也要求 freeze_authority 为 None
        // 虽然 YES token 通过 init 创建，Anchor 默认 freeze_authority=None，
        // 但显式校验提高安全性和代码清晰度
        require!(
            self.yes_token.freeze_authority.is_none(),
            PredictionMarketError::InvalidParameter
        );

        // ═══════════════════════════════════════════════════════════════
        // 🔒 v1.1.0: CRITICAL SECURITY FIX - NO Token 唯一性校验（哨兵代币）
        // ═══════════════════════════════════════════════════════════════
        //
        // **漏洞描述** (发现于安全审计):
        // 之前仅校验 NO mint 的 mint_authority/decimals/freeze_authority，
        // 没有确认该 mint 是否已被其它市场占用或已有供应。
        //
        // **攻击场景**:
        // 1. 攻击者创建市场A（YES_A, NO_A）
        // 2. 攻击者创建市场B（YES_B, NO_A）← 复用市场A的NO mint
        // 3. 两个市场共享同一个 (global_vault, NO_A) 派生的全局 NO ATA
        // 4. 攻击者通过市场B的 seed_pool/swap/resolution 篡改市场A的NO库存
        // 5. 市场A无法正常交易、结算，甚至造成资金损失
        //
        // **修复方案 v1（失败）**:
        // 仅检查 supply == 0 是不够的！因为 mint_no_token 和 create_market
        // 都不会立即铸造 NO 代币，所以第一个市场创建后 supply 仍为 0，
        // 攻击者可以在任何代币真正被铸造前再次使用同一个 NO mint。
        //
        // **修复方案 v2（当前）**:
        // 1. 检查 supply == 0（确保是全新的 mint）
        // 2. 立即为 global_vault 铸造 1 个最小单位的 NO 代币作为"哨兵"
        // 3. 这样 supply 立即变为 1，任何后续尝试复用此 mint 都会失败
        //
        // **哨兵代币方案的优势**:
        // - 简单可靠，无需额外 PDA 或映射结构
        // - 成本极低（1 个最小单位 ≈ 0.000001 NO）
        // - supply > 0 是永久性标记，无法被绕过
        // - 哨兵代币存放在 global_vault，不影响市场逻辑
        //
        // **账本影响说明**:
        // - 哨兵代币不会被纳入 pool_no_reserve、total_no_minted 等账本统计
        // - 实际 mint supply 会比账本多 1 个最小单位（可忽略的偏差）
        // - global_no_token_account.amount 会显示 1，这是正常的占用标记
        // - 在 seed_pool/swap/withdraw 等操作中，1 个最小单位不会影响任何约束
        // - 市场结束后，哨兵代币会留在全局 ATA 中（价值几乎为 0，无需清理）
        // - 若未来需要回收，可在专用清理脚本中由 global_vault 签名 burn 掉
        require!(
            self.no_token.supply == 0,
            PredictionMarketError::TokenAlreadyInUse
        );

        msg!(
            "✅ Token validation passed: YES/NO decimals={}, freeze_authority=None, NO supply=0",
            self.no_token.decimals
        );

        // 立即铸造 1 个最小单位的 NO 代币作为"哨兵"
        // 这确保 supply > 0，防止该 mint 被其他市场复用
        let signer_seeds: &[&[&[u8]]] = &[&[
            crate::constants::GLOBAL.as_bytes(),
            &[_global_vault_bump],
        ]];

        token::mint_to(
            CpiContext::new_with_signer(
                self.token_program.to_account_info(),
                token::MintTo {
                    mint: self.no_token.to_account_info(),
                    to: self.global_no_token_account.to_account_info(),
                    authority: self.global_vault.to_account_info(),
                },
                signer_seeds,
            ),
            1, // 铸造 1 个最小单位作为哨兵
        )?;

        msg!(
            "✅ NO token sentinel minted: 1 smallest unit → supply=1 (market locked to this NO mint)"
        );

        // ✅ v1.2.0: 验证 display_name 长度（最大64字符）
        // 🔒 v1.2.2: 使用 Market::MAX_DISPLAY_NAME_LEN 常量
        require!(
            params.display_name.len() <= Market::MAX_DISPLAY_NAME_LEN,
            PredictionMarketError::InvalidParameter
        );
        require!(
            !params.display_name.is_empty(),
            PredictionMarketError::InvalidParameter
        );

        // 初始化市场账户
        let market_key = self.market.key(); // 在可变借用前获取key
        let market = &mut self.market;
        market.yes_token_mint = self.yes_token.key();
        market.no_token_mint = self.no_token.key();
        market.creator = self.creator.key();
        market.display_name = params.display_name.clone();

        // ═══════════════════════════════════════════════════════════════
        // ✅ 初始化 Settlement Ledger（结算账本）
        // ═══════════════════════════════════════════════════════════════
        // 注意：哨兵代币（1个最小单位）不会被纳入这些账本字段
        // total_no_minted 仅统计通过 mint_complete_set 铸造的用户代币
        market.total_collateral_locked = 0;  // 初始无抵押品
        market.total_yes_minted = 0;         // 初始无铸造
        market.total_no_minted = 0;          // 初始无铸造（哨兵不计入）

        // ═══════════════════════════════════════════════════════════════
        // ✅ 初始化 AMM Pool Ledger（池子账本）
        // ═══════════════════════════════════════════════════════════════
        // 注意：哨兵代币（1个最小单位）不会被纳入这些账本字段
        // pool_no_reserve 仅统计通过 seed_pool/add_liquidity 注入的池子库存
        market.pool_collateral_reserve = 0;  // 初始无流动性
        market.pool_yes_reserve = 0;         // 初始无 YES 库存
        market.pool_no_reserve = 0;          // 初始无 NO 库存（哨兵不计入）
        market.total_lp_shares = 0;          // 初始无 LP Token

        // ═══════════════════════════════════════════════════════════════
        // ✅ 初始化 LMSR 参数
        // ═══════════════════════════════════════════════════════════════
        let config = &self.global_config;
        // b参数决定市场深度：b越大，流动性越好，价格变动越小
        // 典型值：100-1000 USDC（以最小单位为准）
        market.lmsr_b = config.initial_real_token_reserves_config; // 使用配置的储备量作为b

        // ✅ v1.1.1: 双重校验 lmsr_b > 0（防止配置被绕过）
        //
        // 🔒 为什么需要双重检查？
        //    虽然 configure.rs 已校验 initial_real_token_reserves_config > 0，
        //    但增加这层检查作为"纵深防御"策略：
        //    1. 防止配置在链上被直接修改（虽然不太可能）
        //    2. 提高代码可读性（明确 lmsr_b > 0 是市场创建的前提条件）
        //    3. 符合安全最佳实践（每个关键参数在使用前都校验）
        require!(
            market.lmsr_b > 0,
            PredictionMarketError::InvalidParameter
        );

        market.lmsr_q_yes = 0;  // 初始持仓为0（市场中立，价格50/50）
        market.lmsr_q_no = 0;

        // 代币供应量初始化
        market.token_yes_total_supply = 0;
        market.token_no_total_supply = 0;

        market.is_completed = false;

        // ✅ v1.0.19: 添加时间槽验证（感谢审计发现!）
        //
        // 🔴 原问题：未校验 start_slot < ending_slot，也未强制"未来时间"
        //    存在配置错误风险（虽然交易阶段会再次防护）
        //
        // ✅ 修复：添加时间槽合理性检查
        let clock = Clock::get()?;

        // 🔒 v1.2.1: 安全修复 - 验证 start_slot 在未来（如果提供）
        // ✅ v3.0.1: 添加最大延迟限制（30天），防止恶意创建远期市场占用资源
        if let Some(start) = params.start_slot {
            require!(
                start > clock.slot,
                PredictionMarketError::InvalidStartTime
            );

            // 限制最大延迟为 30 天
            let max_allowed_start = clock.slot
                .checked_add(crate::constants::MAX_START_SLOT_DELAY)
                .ok_or(PredictionMarketError::MathOverflow)?;
            require!(
                start <= max_allowed_start,
                PredictionMarketError::InvalidStartTime
            );
        }

        // 检查 1: start_slot 必须 < ending_slot（如果都提供）
        if let (Some(start), Some(end)) = (params.start_slot, params.ending_slot) {
            require!(
                start < end,
                PredictionMarketError::InvalidEndTime
            );
        }

        // 检查 2: ending_slot 必须在未来（如果提供）
        if let Some(end) = params.ending_slot {
            require!(
                end > clock.slot,
                PredictionMarketError::InvalidEndTime
            );
        }

        market.start_slot = params.start_slot;
        market.ending_slot = params.ending_slot;

        // ✅ 初始化Resolution参数
        market.resolution_yes_ratio = 0;
        market.resolution_no_ratio = 0;
        market.winner_token_type = 0;

        // ✅ 初始化Pool结算标志（显式初始化以提高可读性）
        market.pool_settled = false;

        // ✅ 初始化重入保护
        market.swap_in_progress = false;
        market.add_liquidity_in_progress = false;  // ✅ v3.1.4: add_liquidity 重入保护
        market.withdraw_in_progress = false;
        market.claim_in_progress = false;

        // ✅ 初始化LP累计费用
        market.accumulated_lp_fees = 0;
        // ✅ 初始化累计每份额收益（用于公平分配）
        market.fee_per_share_cumulative = 0;

        // ═══════════════════════════════════════════════════════════════
        // ✅ v1.3.0: 初始化初始概率和创建时间
        // ═══════════════════════════════════════════════════════════════

        // 验证并设置初始YES概率
        let initial_yes_prob = if params.initial_yes_prob == 0 {
            crate::constants::DEFAULT_INITIAL_YES_PROB  // 使用默认值50%
        } else {
            // 验证概率在合理范围内（20%-80%）
            require!(
                params.initial_yes_prob >= crate::constants::MIN_INITIAL_YES_PROB,
                PredictionMarketError::ValueTooSmall
            );
            require!(
                params.initial_yes_prob <= crate::constants::MAX_INITIAL_YES_PROB,
                PredictionMarketError::ValueTooLarge
            );
            params.initial_yes_prob
        };

        market.initial_yes_prob = initial_yes_prob;
        market.created_at = clock.unix_timestamp;

        // ═══════════════════════════════════════════════════════════════
        // ✅ v2.0: 初始化保险池市场级追踪
        // ═══════════════════════════════════════════════════════════════
        market.insurance_pool_contribution = 0;

        // ═══════════════════════════════════════════════════════════════
        // ✅ v3.0: 初始化熔断机制字段
        // ═══════════════════════════════════════════════════════════════
        market.circuit_breaker_active = false;
        market.circuit_breaker_triggered_at = 0;
        market.withdraw_last_24h = 0;
        market.withdraw_tracking_start = clock.unix_timestamp;
        market.initial_yes_reserve = 0;  // 将在首次add_liquidity时设置
        market.initial_no_reserve = 0;

        // ✅ v3.1.3: 初始化市场级费率覆盖和市场级暂停
        market.has_fee_override = false;
        market.platform_buy_fee_override = 0;
        market.platform_sell_fee_override = 0;
        market.lp_buy_fee_override = 0;
        market.lp_sell_fee_override = 0;
        market.market_paused = false;

        // ✅ v3.1.3: 初始化哨兵代币追踪（防 NO mint 复用）
        market.sentinel_no_minted = true;  // create_market 总是铸造 1 个哨兵

        msg!("Market initialized: LMSR_b={}, initial_yes_prob={}% ({}bps), created_at={}, insurance_contribution=0",
            market.lmsr_b,
            initial_yes_prob / 100,
            initial_yes_prob,
            clock.unix_timestamp
        );

        // ⚠️ 设计决策：元数据创建在链下或后续交易中完成
        //
        // 原因：
        // 1. 计算单元限制：Metaplex create_metadata_accounts_v3 CPI 消耗大量CU
        // 2. 灵活性：允许创建者在链下更新元数据URI（指向IPFS等）
        // 3. 成本优化：减少单次交易的租金和计算成本
        //
        // 实现方式：
        // - 前端/后端可以在市场创建后立即调用 Metaplex 程序创建元数据
        // - 或使用 update_primary_sale_happened_via_token 等指令更新
        //
        // 账户准备：
        // - yes_token_metadata_account 和 no_token_metadata_account 已在账户结构中声明
        // - PDA 推导正确（使用 METADATA, metadata::ID, token.key 作为种子）
        // - 前端可以直接调用 mpl_token_metadata::create_metadata_accounts_v3
        //
        // 注意：CreateMarketParams 中包含 yes_symbol 和 yes_uri 供前端使用
        msg!("✅ Market tokens created. Metadata creation delegated to client for CU optimization");

        // 创建全局金库的YES代币账户（如果不存在）
        if self.global_yes_token_account.data_is_empty() {
            anchor_spl::associated_token::create(
                CpiContext::new(
                    self.associated_token_program.to_account_info(),
                    anchor_spl::associated_token::Create {
                        payer: self.creator.to_account_info(),
                        associated_token: self.global_yes_token_account.to_account_info(),
                        authority: self.global_vault.to_account_info(),
                        mint: self.yes_token.to_account_info(),
                        system_program: self.system_program.to_account_info(),
                        token_program: self.token_program.to_account_info(),
                    },
                ),
            )?;
            msg!("Global YES token account created");
        }

        // ═══════════════════════════════════════════════════════════════
        // ✅ 发射市场创建事件
        // ═══════════════════════════════════════════════════════════════
        emit!(CreateEvent {
            creator: self.creator.key(),
            market: market_key,
            token_yes: self.yes_token.key(),
            metadata_yes: self.yes_token_metadata_account.key(),
            token_yes_total_supply: market.token_yes_total_supply,
            token_no: self.no_token.key(),
            metadata_no: self.no_token_metadata_account.key(),
            token_no_total_supply: market.token_no_total_supply,
            start_slot: params.start_slot.unwrap_or(0),
            ending_slot: params.ending_slot.unwrap_or(0),
        });

        msg!("CreateMarket completed successfully");
        Ok(())
    }
}
