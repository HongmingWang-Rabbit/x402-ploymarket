"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { useFacilitator } from "x402/verify";
import { PaymentRequirements } from "x402/types";
import { exact } from "x402/schemes";

export async function verifyPayment(
  payload: string,
  amount: string,
  description: string
): Promise<string> {
  // Convert amount to USDC with 6 decimals
  const amountInUSDC = Math.floor(parseFloat(amount) * 1_000_000).toString();

  // Dynamic payment requirements based on user input
  const paymentRequirements: PaymentRequirements = {
    scheme: "exact",
    network: "base-sepolia",
    maxAmountRequired: amountInUSDC,
    resource: "https://example.com",
    description: description,
    mimeType: "text/html",
    payTo: "0x209693Bc6afc0C5328bA36FaF03C514EF312287C",
    maxTimeoutSeconds: 60,
    asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    outputSchema: undefined,
    extra: {
      name: "USDC",
      version: "2",
    },
  };

  const { verify, settle } = useFacilitator(); // eslint-disable-line

  try {
    const payment = exact.evm.decodePayment(payload);
    const valid = await verify(payment, paymentRequirements);
    if (!valid.isValid) {
      throw new Error(valid.invalidReason);
    }

    const settleResponse = await settle(payment, paymentRequirements);

    if (!settleResponse.success) {
      throw new Error(settleResponse.errorReason);
    }

    // Server-side logging after successful payment
    console.log("=".repeat(60));
    console.log("PAYMENT GOOD - Payment processed successfully!");
    console.log("=".repeat(60));
    console.log("Payment Details:");
    console.log("  Amount: $" + amount + " USD");
    console.log("  Description:", description);
    console.log("  Network:", paymentRequirements.network);
    console.log("  Recipient:", paymentRequirements.payTo);
    console.log("  Timestamp:", new Date().toISOString());
    console.log("=".repeat(60));
  } catch (error) {
    console.error("Payment verification failed:", { error });
    return `Error: ${error}`;
  }

  const cookieStore = await cookies();
  // This should be a JWT signed by the server following best practices for a session token
  // See: https://nextjs.org/docs/app/guides/authentication#stateless-sessions
  cookieStore.set("payment-session", payload);
  redirect("/protected");
}
