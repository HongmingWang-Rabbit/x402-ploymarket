# 🚀 快速修复指南

## 如何使用新的安全功能

### 1. 统一重入保护

#### 单锁保护（已有）
```rust
use crate::utils::ReentrancyGuard;

pub fn my_instruction(ctx: Context<MyInstruction>) -> Result<()> {
    let _guard = ReentrancyGuard::new(&mut ctx.accounts.market.swap_in_progress)?;
    // ... 业务逻辑 ...
    Ok(())
}
```

#### 多锁保护（新增）
```rust
use crate::utils::MultiReentrancyGuard;

pub fn complex_instruction(ctx: Context<ComplexInstruction>) -> Result<()> {
    // 同时保护多个操作
    let _guard = MultiReentrancyGuard::new(&[
        &mut ctx.accounts.market.swap_in_progress,
        &mut ctx.accounts.market.add_liquidity_in_progress,
    ])?;
    // ... 业务逻辑 ...
    Ok(())
}
```

#### 全局检查（新增）
```rust
use crate::utils::GlobalReentrancyChecker;

pub fn critical_instruction(ctx: Context<CriticalInstruction>) -> Result<()> {
    // 确保没有任何操作正在进行
    GlobalReentrancyChecker::check_all_clear(&ctx.accounts.market)?;
    // ... 业务逻辑 ...
    Ok(())
}
```

---

### 2. 动态 b 值安全管理

#### 旧方式（不安全）
```rust
// ❌ 不要这样做
let original_b = market.lmsr_b;
market.lmsr_b = effective_b;
// ... 如果这里 panic，b 值永久被修改 ...
market.lmsr_b = original_b; // 可能不会执行
```

#### 新方式（安全）
```rust
use crate::utils::DynamicBGuard;

// ✅ 推荐做法
let effective_b = market.calculate_effective_lmsr_b()?;
let _b_guard = DynamicBGuard::new(&mut market.lmsr_b, effective_b);
// ... 业务逻辑 ...
// b 值在函数返回时自动恢复，即使发生 panic
```

---

### 3. 保险池资金隔离

#### 验证补偿请求
```rust
use crate::insurance::InsurancePoolValidator;

pub fn withdraw_liquidity(ctx: Context<WithdrawLiquidity>, lp_shares: u64) -> Result<()> {
    // 1. 计算 LP 损失
    let invested_usdc = ctx.accounts.lp_position.invested_usdc;
    let withdrawn_usdc = calculate_withdrawn_amount(lp_shares)?;
    
    // 2. 计算应补偿金额
    let requested_compensation = InsurancePoolValidator::calculate_compensation_amount(
        &ctx.accounts.global_config,
        invested_usdc,
        withdrawn_usdc,
    );
    
    if requested_compensation > 0 {
        // 3. 验证补偿请求（市场级限额检查）
        let actual_compensation = InsurancePoolValidator::validate_compensation(
            &ctx.accounts.global_config,
            &ctx.accounts.market,
            requested_compensation,
        )?;
        
        // 4. 执行补偿（更新账本）
        InsurancePoolValidator::apply_compensation(
            &mut ctx.accounts.global_config,
            &mut ctx.accounts.market,
            actual_compensation,
        )?;
        
        // 5. 转账 USDC（从市场金库到用户）
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                token::Transfer {
                    from: ctx.accounts.market_usdc_ata.to_account_info(),
                    to: ctx.accounts.user_usdc_ata.to_account_info(),
                    authority: ctx.accounts.market_usdc_vault.to_account_info(),
                },
                signer_seeds,
            ),
            actual_compensation,
        )?;
        
        msg!("✅ Insurance compensation paid: {} USDC", actual_compensation);
    }
    
    Ok(())
}
```

#### 查询保险池状态
```rust
// 检查市场是否有足够的保险池贡献额
let has_sufficient = InsurancePoolValidator::has_sufficient_market_contribution(
    &market,
    required_amount,
);

// 获取市场可用的保险池余额
let available = InsurancePoolValidator::get_available_balance(
    &global_config,
    &market,
);

// 计算损失率
let loss_rate = InsurancePoolValidator::calculate_loss_rate(
    invested_usdc,
    withdrawn_usdc,
);
```

---

### 4. 配置参数验证

#### 在 configure 指令中自动验证
```rust
// 所有验证已集成到 configure 指令中
// 管理员调用 configure 时会自动检查：

// 1. usdc_vault_min_balance <= 1 USDC
// 2. min_usdc_liquidity <= 10,000 USDC
// 3. 保险池参数 <= 100%
// 4. 保险池启用时必须有平台费
// 5. 保险池参数合理性警告

pub fn configure(ctx: Context<Configure>, new_config: Config) -> Result<()> {
    ctx.accounts.handler(new_config, ctx.bumps.config, ctx.bumps.global_vault)
    // 所有验证在 handler 内部完成
}
```

---

## 🔍 常见问题

### Q1: 如何选择使用哪种重入保护？

**A**: 根据指令复杂度选择：
- **单锁**: 简单指令，只涉及一个操作（如 swap）
- **多锁**: 复杂指令，涉及多个操作（如 swap + add_liquidity）
- **全局检查**: 关键指令，需要独占访问（如 resolution, settle_pool）

### Q2: DynamicBGuard 会影响性能吗？

**A**: 不会。DynamicBGuard 使用 RAII 模式，编译器会内联优化，零运行时开销。

### Q3: 保险池验证会增加 gas 成本吗？

**A**: 会略微增加（约 1000-2000 CU），但换来的是资金安全，非常值得。

### Q4: 如何测试新的安全功能？

**A**: 参考 `programs/prediction-market/src/insurance.rs` 中的单元测试示例。

---

## 📚 相关文档

- [完整修复报告](./SECURITY_FIXES_v3.2.0.md)
- [审核报告](./AUDIT_REPORT.md)（如果有）
- [API 文档](./docs/API.md)（如果有）

---

## ⚠️ 重要提示

1. **不要移除旧的重入保护代码**，新旧代码可以共存
2. **逐步迁移**到新的安全功能，不要一次性修改所有指令
3. **充分测试**每个修改后的指令
4. **在测试网部署**前进行全面测试

---

## 🆘 需要帮助？

如果在使用新功能时遇到问题：
1. 查看代码注释（每个函数都有详细文档）
2. 查看单元测试示例
3. 联系开发团队

**最后更新**: 2024-11-08  
**版本**: v3.2.0
