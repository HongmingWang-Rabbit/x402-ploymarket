import { Address } from "viem";
import { paymentMiddleware, Resource, Network } from "x402-next";
import { NextRequest, NextResponse } from "next/server";

const address = process.env.NEXT_PUBLIC_RECEIVER_ADDRESS as Address;
const network = process.env.NEXT_PUBLIC_NETWORK as Network;
const facilitatorUrl = process.env.NEXT_PUBLIC_FACILITATOR_URL as Resource;
const cdpClientKey = process.env.NEXT_PUBLIC_CDP_CLIENT_KEY as string;

const x402PaymentMiddleware = paymentMiddleware(
  address,
  {
    "/content/cheap": {
      price: "$0.01",
      config: {
        description: "Access to cheap content",
      },
      network,
    },
    "/content/expensive": {
      price: "$0.25",
      config: {
        description: "Access to expensive content",
      },
      network,
    },
  },
  {
    url: facilitatorUrl,
  },
  {
    cdpClientKey,
    appLogo: "/logos/x402-examples.png",
    appName: "x402 Demo",
    sessionTokenEndpoint: "/api/x402/session-token",
  }
);

export const middleware = (req: NextRequest) => {
  // Don't check payment on homepage or paywall page itself
  const isPublicPath = req.nextUrl.pathname === '/' ||
                       req.nextUrl.pathname === '/paywall' ||
                       req.nextUrl.pathname.startsWith('/api/');

  if (isPublicPath) {
    return NextResponse.next();
  }

  const paymentHeader = req.cookies.get("payment-session");

  if (!paymentHeader) {
    return NextResponse.redirect(new URL("/paywall", req.url));
  }

  const delegate = x402PaymentMiddleware as unknown as (
    request: NextRequest
  ) => ReturnType<typeof x402PaymentMiddleware>;

  return delegate(req);
};

// Configure which paths the middleware should run on
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (metadata files)
     * - logos (logo files)
     */
    "/((?!_next/static|_next/image|favicon.ico|logos).*)",
  ],
};
