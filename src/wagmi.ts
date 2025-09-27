import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { http } from "wagmi";
import { base, baseSepolia } from "wagmi/chains";

export const config = getDefaultConfig({
  appName: "RainbowKit demo",
  projectId: "8a002f09d4fc6fba7c4cd6d06df5e19f",
  chains: [base, baseSepolia],
  ssr: true,
  transports: {
    [base.id]: http("https://base-rpc.publicnode.com"),
    // Base Sepolia dedicated endpoint
    [baseSepolia.id]: http("https://base-sepolia-rpc.publicnode.com"),
  },
});
