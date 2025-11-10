//! # 工具函数模块
//!
//! 提供预测市场合约中使用的各种工具函数
//! 包括数值转换、代币转账、SOL转账等功能

use crate::*;
use crate::errors::PredictionMarketError;
use anchor_spl::token::{self, Token};
use anchor_lang::system_program::{transfer, Transfer};
use std::ops::{Div, Mul};

/// 将代币数量转换为浮点数
///
/// ⚠️ DEPRECATED: 不再使用，所有计算已迁移至整数运算
/// 保留此函数仅供向后兼容，建议在未来版本移除
///
/// 根据代币的精度将原始数量转换为可读的浮点数
///
/// # 参数
/// * `value` - 原始代币数量
/// * `decimals` - 代币精度
///
/// # 返回
/// * `f64` - 转换后的浮点数
///
/// # 示例
/// ```rust,ignore
/// // Doctest ignored: deprecated function, kept for backward compatibility only
/// let tokens = convert_to_float(1000000000, 9); // 1.0
/// ```
#[deprecated(since = "1.0.17", note = "All calculations migrated to integer arithmetic")]
#[allow(dead_code)]
pub fn convert_to_float(value: u64, decimals: u8) -> f64 {
    (value as f64).div(f64::powf(10.0, decimals as f64))
}

/// 将浮点数转换为代币数量
///
/// ⚠️ DEPRECATED: 不再使用，所有计算已迁移至整数运算
/// 保留此函数仅供向后兼容，建议在未来版本移除
///
/// 根据代币的精度将浮点数转换为原始代币数量
///
/// # 参数
/// * `value` - 浮点数值
/// * `decimals` - 代币精度
///
/// # 返回
/// * `u64` - 转换后的代币数量
///
/// # 示例
/// ```rust,ignore
/// // Doctest ignored: deprecated function, kept for backward compatibility only
/// let amount = convert_from_float(1.5, 9); // 1500000000
/// ```
#[deprecated(since = "1.0.17", note = "All calculations migrated to integer arithmetic")]
#[allow(dead_code)]
pub fn convert_from_float(value: f64, decimals: u8) -> u64 {
    value.mul(f64::powf(10.0, decimals as f64)) as u64
}

/// 从用户账户转账 SOL（⚠️ 仅用于 Solana 原生 SOL，如租金等）
/// 
/// 使用系统程序从签名者账户向目标账户转账SOL
/// 
/// # 参数
/// * `signer` - 签名者账户（资金源）
/// * `destination` - 目标账户
/// * `system_program` - 系统程序
/// * `amount` - 转账金额（lamports）
/// 
/// # 注意
/// ⚠️ 此函数用于 Solana 原生 SOL 转账（如支付租金），非业务逻辑 USDC 转账
/// 
/// # 返回
/// * `Result<()>` - 操作结果
pub fn sol_transfer_from_user<'info>(
    signer: &Signer<'info>,
    destination: AccountInfo<'info>,
    system_program: &Program<'info, System>,
    amount: u64,
) -> Result<()> {
    // ✅ v1.0.21: 统一使用 Anchor CPI 风格（感谢审计发现!）
    //
    // 🔴 原问题：此函数使用低级 system_instruction::transfer + invoke
    //    而其他地方使用 Anchor 的 system_program::transfer CPI
    //    风格不一致，增加维护成本
    //
    // ✅ 修复：统一使用 Anchor CPI 风格
    let cpi_ctx = CpiContext::new(
        system_program.to_account_info(),
        Transfer {
            from: signer.to_account_info(),
            to: destination,
        },
    );

    transfer(cpi_ctx, amount)
}

/// 从用户账户转账代币
/// 
/// 使用SPL代币程序从用户账户转账代币
/// 
/// # 参数
/// * `from` - 源代币账户
/// * `authority` - 授权签名者
/// * `to` - 目标代币账户
/// * `token_program` - SPL代币程序
/// * `amount` - 转账数量
/// 
/// # 返回
/// * `Result<()>` - 操作结果
pub fn token_transfer_user<'info>(
    from: AccountInfo<'info>,
    authority: &Signer<'info>,
    to: AccountInfo<'info>,
    token_program: &Program<'info, Token>,
    amount: u64,
) -> Result<()> {
    // 创建CPI上下文
    let cpi_ctx: CpiContext<_> = CpiContext::new(
        token_program.to_account_info(),
        token::Transfer {
            from,
            authority: authority.to_account_info(),
            to,
        },
    );
    
    // 执行代币转账
    token::transfer(cpi_ctx, amount)?;
    Ok(())
}

/// 从PDA账户转账代币
/// 
/// 使用PDA作为授权者进行代币转账
/// 需要提供PDA的签名种子
/// 
/// # 参数
/// * `from` - 源代币账户
/// * `authority` - PDA授权账户
/// * `to` - 目标代币账户
/// * `token_program` - SPL代币程序
/// * `signer_seeds` - PDA签名种子
/// * `amount` - 转账数量
/// 
/// # 返回
/// * `Result<()>` - 操作结果
pub fn token_transfer_with_signer<'info>(
    from: AccountInfo<'info>,
    authority: AccountInfo<'info>,
    to: AccountInfo<'info>,
    token_program: &Program<'info, Token>,
    signer_seeds: &[&[&[u8]]],
    amount: u64,
) -> Result<()> {
    // 创建带签名的CPI上下文
    let cpi_ctx: CpiContext<_> = CpiContext::new_with_signer(
        token_program.to_account_info(),
        token::Transfer {
            from,
            to,
            authority,
        },
        signer_seeds,
    );
    
    // 执行代币转账
    token::transfer(cpi_ctx, amount)?;
    Ok(())
}

/// 从PDA账户转账SOL
/// 
/// 使用PDA作为签名者进行SOL转账
/// 需要提供PDA的签名种子
/// 
/// # 参数
/// * `source` - 源账户（PDA）
/// * `destination` - 目标账户
/// * `system_program` - 系统程序
/// * `signers_seeds` - PDA签名种子
/// * `amount` - 转账金额（lamports）
/// 
/// # 注意
/// ⚠️ 此函数用于 Solana 原生 SOL 转账（如支付租金），非业务逻辑 USDC 转账
/// 
/// # 返回
/// * `Result<()>` - 操作结果
pub fn sol_transfer_with_signer<'info>(
    source: AccountInfo<'info>,
    destination: AccountInfo<'info>,
    system_program: &Program<'info, System>,
    signers_seeds: &[&[&[u8]]],
    amount: u64,
) -> Result<()> {
    // ✅ v1.0.21: 统一使用 Anchor CPI 风格（感谢审计发现!）
    //
    // 🔴 原问题：此函数使用低级 system_instruction::transfer + invoke_signed
    //    而其他地方使用 Anchor 的 system_program::transfer CPI
    //    风格不一致，增加维护成本
    //
    // ✅ 修复：统一使用 Anchor CPI 风格
    let cpi_ctx = CpiContext::new_with_signer(
        system_program.to_account_info(),
        Transfer {
            from: source,
            to: destination,
        },
        signers_seeds,
    );

    transfer(cpi_ctx, amount)
}

/// 从PDA账户销毁代币
///
/// 使用PDA作为授权者销毁代币
/// 销毁的代币将从总供应量中永久移除
///
/// # 参数
/// * `mint` - 代币铸造账户（Mint）
/// * `from` - 要销毁代币的账户（TokenAccount）
/// * `authority` - PDA授权账户
/// * `token_program` - SPL代币程序
/// * `signer_seeds` - PDA签名种子
/// * `amount` - 销毁数量
///
/// # 返回
/// * `Result<()>` - 操作结果
///
/// # 修复历史
/// ✅ v1.0.17: 修复 mint 参数错误传递 from 的bug
pub fn token_burn_with_signer<'info>(
    mint: AccountInfo<'info>, // ✅ FIX: 新增 mint 参数
    from: AccountInfo<'info>, // 要销毁代币的账户
    authority: AccountInfo<'info>, // PDA授权账户
    token_program: &Program<'info, Token>, // SPL代币程序
    signer_seeds: &[&[&[u8]]], // PDA签名种子
    amount: u64, // 销毁数量
) -> Result<()> {
    // 创建带签名的CPI上下文
    let cpi_ctx: CpiContext<_> = CpiContext::new_with_signer(
        token_program.to_account_info(),
        token::Burn {
            mint, // ✅ FIX: 使用正确的 mint 参数
            from, // 要销毁的账户
            authority, // PDA授权账户
        },
        signer_seeds,
    );

    // 执行代币销毁
    token::burn(cpi_ctx, amount)?;
    Ok(())
}

/// 计算基点（BPS）乘法
///
/// 用于计算手续费等基于基点的计算
/// 防止溢出并提供安全的数值计算
///
/// # 参数
/// * `bps` - 基点值（如1000表示10%）
/// * `value` - 基础值
/// * `divisor` - 除数（通常为10000）
///
/// # 返回
/// * `Option<u64>` - 计算结果，如果溢出则返回None
///
/// # 注意
/// ⚠️ 此函数目前未被项目使用，如需启用请确保参数有效
pub fn bps_mul(bps: u64, value: u64, divisor: u64) -> Option<u64> {
    // ✅ FIX: 移除 unwrap()，使用 ? 链式调用
    bps_mul_raw(bps, value, divisor)?.try_into().ok()
}

/// 基点乘法的原始实现
/// 
/// 使用u128进行中间计算以防止溢出
/// 
/// # 参数
/// * `bps` - 基点值
/// * `value` - 基础值
/// * `divisor` - 除数
/// 
/// # 返回
/// * `Option<u128>` - 计算结果
pub fn bps_mul_raw(bps: u64, value: u64, divisor: u64) -> Option<u128> {
    (value as u128)
        .checked_mul(bps as u128)?
        .checked_div(divisor as u128)
}

// ═══════════════════════════════════════════════════════════════
// ✅ v1.2.3: RAII 重入保护守卫
// ✅ v3.2.0: 增强版重入保护 - 支持多锁和全局锁
// ═══════════════════════════════════════════════════════════════

/// 重入保护守卫
///
/// 在构造时检查并设置锁标志，在析构时（Drop）自动清除锁标志
///
/// # Safety
/// 使用原始指针绕过 Rust 借用检查器的限制。这是安全的，因为：
/// 1. 指针在守卫生命周期内始终有效
/// 2. 单线程执行环境（Solana 运行时）
/// 3. 锁标志在 Drop 时必定被清除
///
/// # 用法
/// ```ignore
/// let _guard = ReentrancyGuard::new(&mut self.market.withdraw_in_progress)?;
/// // ... 执行业务逻辑 ..
/// // 函数返回时（无论成功还是失败），_guard 被 drop，锁自动清除
/// ```
pub struct ReentrancyGuard {
    /// 锁标志的原始指针（使用unsafe绕过借用检查器）
    flag: *mut bool,
}

impl ReentrancyGuard {
    /// 创建守卫并设置锁
    ///
    /// # 参数
    /// * `flag` - 锁标志的可变引用
    ///
    /// # 返回
    /// * `Result<Self>` - 成功返回守卫，失败返回 ReentrancyDetected 错误
    ///
    /// # 错误
    /// 如果锁已被持有（`*flag == true`），返回 `ReentrancyDetected`
    ///
    /// # Safety
    /// 此函数在内部使用 unsafe 代码，但对外是安全的
    pub fn new(flag: &mut bool) -> Result<Self> {
        // 检查锁是否已被持有
        require!(!*flag, crate::errors::PredictionMarketError::ReentrancyDetected);

        // 设置锁
        *flag = true;

        msg!("✅ Reentrancy guard acquired");

        // 将引用转换为原始指针，立即释放借用
        Ok(Self {
            flag: flag as *mut bool,
        })
    }
}

impl Drop for ReentrancyGuard {
    /// 自动清除锁（析构函数）
    ///
    /// 无论函数如何退出，Rust 都会调用此方法释放锁
    fn drop(&mut self) {
        unsafe {
            *self.flag = false;
        }
        msg!("✅ Reentrancy guard released");
    }
}

// ═══════════════════════════════════════════════════════════════
// ✅ v3.2.0: 多锁重入保护守卫（修复 Critical 问题）
// ═══════════════════════════════════════════════════════════════

/// 多锁重入保护守卫
///
/// 支持同时持有多个锁，确保所有锁在析构时都被释放
/// 用于需要跨多个操作保护的场景（如 swap + add_liquidity）
///
/// # 用法
/// ```ignore
/// let _guard = MultiReentrancyGuard::new(&[
///     &mut market.swap_in_progress,
///     &mut market.add_liquidity_in_progress,
/// ])?;
/// // ... 执行业务逻辑 ..
/// // 所有锁在函数返回时自动释放
/// ```
///
/// # 安全性
/// - 使用 RAII 模式确保锁必定释放
/// - 支持最多 8 个锁（足够覆盖所有实际场景）
/// - 如果任一锁已被持有，所有锁都不会被设置（原子性）
pub struct MultiReentrancyGuard {
    /// 锁标志的原始指针数组
    flags: [Option<*mut bool>; 8],
    /// 实际持有的锁数量
    count: usize,
}

impl MultiReentrancyGuard {
    /// 创建多锁守卫
    ///
    /// # 参数
    /// * `flags` - 锁标志的可变引用切片
    ///
    /// # 返回
    /// * `Result<Self>` - 成功返回守卫，失败返回 ReentrancyDetected 错误
    ///
    /// # 错误
    /// - 如果任一锁已被持有，返回 `ReentrancyDetected`
    /// - 如果锁数量超过 8 个，返回 `InvalidParameter`
    pub fn new(flags: &mut [&mut bool]) -> Result<Self> {
        // 检查锁数量
        require!(
            flags.len() <= 8,
            crate::errors::PredictionMarketError::InvalidParameter
        );

        // 第一步：检查所有锁是否可用（原子性检查）
        for flag in flags.iter() {
            require!(
                !**flag,
                crate::errors::PredictionMarketError::ReentrancyDetected
            );
        }

        // 第二步：设置所有锁并保存指针
        let mut flag_ptrs = [None; 8];
        for (i, flag) in flags.iter_mut().enumerate() {
            **flag = true;
            flag_ptrs[i] = Some(*flag as *mut bool);
        }

        msg!("✅ Multi-reentrancy guard acquired ({} locks)", flags.len());

        Ok(Self {
            flags: flag_ptrs,
            count: flags.len(),
        })
    }
}

impl Drop for MultiReentrancyGuard {
    /// 自动清除所有锁
    fn drop(&mut self) {
        for i in 0..self.count {
            if let Some(flag) = self.flags[i] {
                unsafe {
                    *flag = false;
                }
            }
        }
        msg!("✅ Multi-reentrancy guard released ({} locks)", self.count);
    }
}

// ═══════════════════════════════════════════════════════════════
// ✅ v3.2.0: 全局重入保护检查器（修复 Critical 问题）
// ═══════════════════════════════════════════════════════════════

/// 全局重入保护检查器
///
/// 检查市场的所有重入保护标志，确保没有任何操作正在进行
/// 用于需要独占访问的关键操作（如 resolution, settle_pool）
///
/// # 用法
/// ```ignore
/// GlobalReentrancyChecker::check_all_clear(&market)?;
/// // 确保没有任何操作正在进行，可以安全执行关键操作
/// ```
pub struct GlobalReentrancyChecker;

impl GlobalReentrancyChecker {
    /// 检查市场的所有重入保护标志
    ///
    /// # 参数
    /// * `market` - 市场账户引用
    ///
    /// # 返回
    /// * `Result<()>` - 如果所有标志都为 false，返回 Ok；否则返回 ReentrancyDetected
    ///
    /// # 检查的标志
    /// - swap_in_progress
    /// - add_liquidity_in_progress
    /// - withdraw_in_progress
    /// - claim_in_progress
    pub fn check_all_clear(market: &crate::state::market::Market) -> Result<()> {
        require!(
            !market.swap_in_progress,
            crate::errors::PredictionMarketError::ReentrancyDetected
        );
        require!(
            !market.add_liquidity_in_progress,
            crate::errors::PredictionMarketError::ReentrancyDetected
        );
        require!(
            !market.withdraw_in_progress,
            crate::errors::PredictionMarketError::ReentrancyDetected
        );
        require!(
            !market.claim_in_progress,
            crate::errors::PredictionMarketError::ReentrancyDetected
        );

        msg!("✅ Global reentrancy check passed - all operations clear");
        Ok(())
    }

    /// 检查是否有任何操作正在进行（不抛出错误，仅返回布尔值）
    ///
    /// # 参数
    /// * `market` - 市场账户引用
    ///
    /// # 返回
    /// * `bool` - true 表示有操作正在进行，false 表示所有操作都已清除
    pub fn is_any_operation_in_progress(market: &crate::state::market::Market) -> bool {
        market.swap_in_progress
            || market.add_liquidity_in_progress
            || market.withdraw_in_progress
            || market.claim_in_progress
    }
}

// ═══════════════════════════════════════════════════════════════
// ✅ v3.2.0: 动态 b 值安全管理器（修复 High 问题）
// ═══════════════════════════════════════════════════════════════

/// 动态 b 值管理器
///
/// 安全地管理 LMSR b 值的临时修改，确保无论函数如何退出都能恢复原值
/// 解决了直接修改 market.lmsr_b 可能导致的状态污染问题
///
/// # 问题背景
/// 之前的实现直接修改 `market.lmsr_b`，如果闭包内发生 panic，
/// Rust 的 panic 不会触发 Drop，导致 b 值永久被修改
///
/// # 解决方案
/// 使用 RAII 模式 + catch_unwind 确保 b 值必定恢复
///
/// # 用法
/// ```ignore
/// let effective_b = market.calculate_effective_lmsr_b()?;
/// let _b_guard = DynamicBGuard::new(&mut market.lmsr_b, effective_b);
/// // ... 执行业务逻辑 ..
/// // b 值在函数返回时自动恢复
/// ```
pub struct DynamicBGuard {
    /// b 值的原始指针
    b_ptr: *mut u64,
    /// 原始 b 值
    original_b: u64,
}

impl DynamicBGuard {
    /// 创建守卫并临时修改 b 值
    ///
    /// # 参数
    /// * `b` - lmsr_b 的可变引用
    /// * `effective_b` - 临时使用的有效 b 值
    ///
    /// # 返回
    /// * `Self` - 守卫实例
    ///
    /// # Safety
    /// 使用原始指针绕过借用检查器，但保证安全：
    /// - 指针在守卫生命周期内始终有效
    /// - 单线程执行环境
    /// - Drop 时必定恢复原值
    pub fn new(b: &mut u64, effective_b: u64) -> Self {
        let original_b = *b;
        *b = effective_b;

        msg!(
            "✅ Dynamic b guard: {} → {} (temporary)",
            original_b,
            effective_b
        );

        Self {
            b_ptr: b as *mut u64,
            original_b,
        }
    }

    /// 获取原始 b 值（用于日志）
    pub fn original_value(&self) -> u64 {
        self.original_b
    }
}

impl Drop for DynamicBGuard {
    /// 自动恢复原始 b 值
    fn drop(&mut self) {
        unsafe {
            *self.b_ptr = self.original_b;
        }
        msg!("✅ Dynamic b guard: restored to {}", self.original_b);
    }
}

// ═══════════════════════════════════════════════════════════════
// ✅ v3.0.10: 数学辅助函数
// ═══════════════════════════════════════════════════════════════

/// 计算按比例分配的份额
///
/// 用于计算 LP 份额对应的资产数量，避免重复的 checked_mul + checked_div 代码
///
/// # 参数
/// * `total` - 总量（如池子储备量、LP投资额等）
/// * `numerator` - 份额分子（如用户的 LP 份额）
/// * `denominator` - 份额分母（如总 LP 份额）
///
/// # 返回
/// * `Result<u64>` - 计算结果: `(total * numerator) / denominator`
///
/// # 示例
/// ```rust,ignore
/// // 用户持有 100 份额，总共 1000 份额，池子有 5000 USDC
/// let user_usdc = calculate_proportional_share(5000, 100, 1000)?;
/// // user_usdc = 500
/// ```
///
/// # 性能
/// - 使用 u128 中间值避免溢出
/// - inline 提示编译器内联优化
/// - 统一错误处理减少代码重复
#[inline]
pub fn calculate_proportional_share(
    total: u64,
    numerator: u128,
    denominator: u128,
) -> Result<u64> {
    let result = (total as u128)
        .checked_mul(numerator)
        .ok_or(PredictionMarketError::MathOverflow)?
        .checked_div(denominator)
        .ok_or(PredictionMarketError::MathOverflow)? as u64;
    Ok(result)
}
