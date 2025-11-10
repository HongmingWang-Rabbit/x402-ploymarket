# 获取测试 USDC

## 方法 1: Circle Faucet (推荐)
访问: https://faucet.circle.com/

1. 选择 Solana Devnet
2. 输入你的钱包地址: `2eExwMwQPhsAKXKygjpA6VChkr1iMgPugjrX47F6Tkyr`
3. 点击 "Request USDC"
4. 等待几秒钟，你将收到 10 USDC

## 方法 2: 使用 SPL Token Faucet
```bash
# 安装 spl-token-cli (如果还没有)
cargo install spl-token-cli

# 获取测试 USDC
spl-token airdrop 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU 10 \
  --url devnet \
  --owner ~/.config/solana/id.json
```

## 方法 3: 从其他 Devnet 账户转账
如果你有其他 Devnet 账户有 USDC，可以转账过来：

```bash
spl-token transfer 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU 10 \
  2eExwMwQPhsAKXKygjpA6VChkr1iMgPugjrX47F6Tkyr \
  --url devnet \
  --fund-recipient
```

## 验证余额
```bash
spl-token balance 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU \
  --url devnet \
  --owner ~/.config/solana/id.json
```

## 你的账户信息
- **钱包地址**: `2eExwMwQPhsAKXKygjpA6VChkr1iMgPugjrX47F6Tkyr`
- **USDC Mint (Devnet)**: `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU`
- **需要金额**: 至少 0.01 USDC (测试只需要很少)

## 获取 USDC 后
运行测试脚本继续测试：
```bash
npx ts-node scripts/test-full-market-flow.ts
```

## 已创建的市场信息
- **Market PDA**: `7k7HjxJKWRLACzKMhyxzvWPERiLZ3wZ7RLi3D3sZmAFq`
- **YES Token**: `38m9iTqYN91kD8pMaK4Fp9BQxpnjvX7eBsL44gTPGi9C`
- **NO Token**: `4FNGw53KiK2qzCeMWZJoaPPAJ31vy1APQeCu97jxYEyd`
- **查看市场**: https://explorer.solana.com/address/7k7HjxJKWRLACzKMhyxzvWPERiLZ3wZ7RLi3D3sZmAFq?cluster=devnet
