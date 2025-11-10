/**
 * 测试已存在市场的功能
 * - 买卖 YES/NO 代币
 * - 添加/移除流动性
 */

import * as anchor from '@coral-xyz/anchor';
import { BN } from '@coral-xyz/anchor';
import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import { 
  TOKEN_PROGRAM_ID, 
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  getAccount,
} from '@solana/spl-token';
import * as fs from 'fs';
import * as path from 'path';

const PROGRAM_ID = new PublicKey('CzddKJkrkAAsECFhEA1KzNpL7RdrZ6PYG7WEkNRrXWgM');
const USDC_MINT = new PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU');
const RPC_URL = 'https://api.devnet.solana.com';

// 替换为你的市场地址
const MARKET_ADDRESS = new PublicKey('YOUR_MARKET_ADDRESS_HERE');

async function main() {
  console.log('🧪 测试已存在市场的功能\n');
  console.log('='.repeat(60));

  // 加载钱包
  const keypairPath = path.join(process.env.HOME!, '.config/solana/id.json');
  const payer = Keypair.fromSecretKey(
    new Uint8Array(JSON.parse(fs.readFileSync(keypairPath, 'utf-8')))
  );

  console.log('📍 测试钱包:', payer.publicKey.toString());

  const connection = new Connection(RPC_URL, 'confirmed');
  const wallet = new anchor.Wallet(payer);
  const provider = new anchor.AnchorProvider(connection, wallet, { 
    commitment: 'confirmed',
  });

  const idlPath = path.join(__dirname, '../target/idl/prediction_market.json');
  const idl = JSON.parse(fs.readFileSync(idlPath, 'utf-8'));
  const program = new anchor.Program(idl, provider);

  // 获取市场信息
  console.log('\n📊 获取市场信息...');
  const market = await (program.account as any).market.fetch(MARKET_ADDRESS);
  
  console.log('市场名称:', market.displayName);
  console.log('YES Token:', market.yesTokenMint.toString());
  console.log('NO Token:', market.noTokenMint.toString());
  console.log('Pool YES Reserve:', market.poolYesReserve.toString());
  console.log('Pool NO Reserve:', market.poolNoReserve.toString());
  console.log('Pool USDC Reserve:', market.poolCollateralReserve.toString());
  console.log('Total LP Shares:', market.totalLpShares.toString());

  console.log('\n✅ 市场信息获取成功！');
  console.log('\n提示：修改脚本中的 MARKET_ADDRESS 为实际市场地址后运行');
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('❌ 错误:', err.message);
    process.exit(1);
  });
