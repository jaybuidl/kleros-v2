import { type Chain, mainnet, arbitrumSepolia, gnosisChiado, arbitrum, gnosis } from "viem/chains";

import { isProductionDeployment } from "./index";

export const DEFAULT_CHAIN = isProductionDeployment() ? arbitrum.id : arbitrumSepolia.id;

export const SUPPORTED_CHAINS: Record<number, Chain> = {
  [isProductionDeployment() ? arbitrum.id : arbitrumSepolia.id]: isProductionDeployment() ? arbitrum : arbitrumSepolia,
};

export const QUERY_CHAINS: Record<number, Chain> = {
  [isProductionDeployment() ? gnosis.id : gnosisChiado.id]: isProductionDeployment() ? gnosis : gnosisChiado,
  [mainnet.id]: mainnet,
};

export const ALL_CHAINS = [...Object.values(SUPPORTED_CHAINS), ...Object.values(QUERY_CHAINS)];