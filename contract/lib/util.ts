// 工具函数
import { Connection, PublicKey, Transaction, Keypair, SendOptions } from "@solana/web3.js";
import { BN, Program, AnchorProvider } from "@coral-xyz/anchor";
import { PredictionMarket } from "../target/types/prediction_market";

export function createProvider(): AnchorProvider {
  return AnchorProvider.env();
}

export async function execTx(
  tx: Transaction,
  connection: Connection,
  payer: any
): Promise<string> {
  const options: SendOptions = {
    skipPreflight: true,
  };
  
  const signature = await connection.sendTransaction(tx, [payer], options);
  
  await connection.confirmTransaction(signature, "confirmed");
  return signature;
}
