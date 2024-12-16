import React from "react";

import { createWeb3Modal } from "@web3modal/wagmi/react";
import { type Chain } from "viem";
import { createConfig, fallback, http, WagmiProvider, webSocket } from "wagmi";
import { mainnet, arbitrumSepolia, arbitrum, gnosisChiado, sepolia, gnosis } from "wagmi/chains";
import { walletConnect } from "wagmi/connectors";

import { ALL_CHAINS } from "consts/chains";

import { theme } from "styles/Theme";

const alchemyApiKey = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY;
if (!alchemyApiKey) {
  throw new Error("Alchemy API key is not set in NEXT_PUBLIC_ALCHEMY_API_KEY environment variable.");
}

// https://github.com/alchemyplatform/alchemy-sdk-js/blob/c4440cb/src/types/types.ts#L98-L153
const alchemyToViemChain: Record<number, string> = {
  [arbitrumSepolia.id]: "arb-sepolia",
  [arbitrum.id]: "arb-mainnet",
  [mainnet.id]: "eth-mainnet",
  [sepolia.id]: "eth-sepolia",
  [gnosis.id]: "gnosis-mainnet",
  [gnosisChiado.id]: "gnosis-chiado",
};

type AlchemyProtocol = "https" | "wss";

// https://github.com/alchemyplatform/alchemy-sdk-js/blob/c4440cb/src/util/const.ts#L16-L18
function alchemyURL(protocol: AlchemyProtocol, chainId: number): string {
  const network = alchemyToViemChain[chainId];
  if (!network) {
    throw new Error(`Unsupported chain ID: ${chainId}`);
  }
  return `${protocol}://${network}.g.alchemy.com/v2/${alchemyApiKey}`;
}

export const getTransports = () => {
  const alchemyTransport = (chain: Chain) =>
    fallback([http(alchemyURL("https", chain.id)), webSocket(alchemyURL("wss", chain.id))]);

  return {
    [arbitrumSepolia.id]: alchemyTransport(arbitrumSepolia),
    [mainnet.id]: alchemyTransport(mainnet), // Always enabled for ENS resolution
  };
};

const chains = ALL_CHAINS as [Chain, ...Chain[]];
const transports = getTransports();

const projectId = process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID;
if (!projectId) {
  throw new Error("WalletConnect project ID is not set in NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID environment variable.");
}

const wagmiConfig = createConfig({
  chains,
  transports,
  connectors: [walletConnect({ projectId })],
});

createWeb3Modal({
  wagmiConfig,
  projectId,
  defaultChain: arbitrumSepolia,
  themeVariables: {
    "--w3m-color-mix": theme.klerosUIComponentsPrimaryPurple,
    "--w3m-color-mix-strength": 20,
  },
});

const Web3Provider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <WagmiProvider config={wagmiConfig}> {children} </WagmiProvider>;
};

export default Web3Provider;
