/**
 * Ethers Deploy Script
 *
 * PRIVATE_KEY="private-key" ts-node scripts/deploy_liquidator_change-uniswap.ts "{network}"
 *
 */

import { ethers } from 'ethers'
import { JsonRpcProvider } from 'ethers/providers'
import { LiquidatorUniswapChangeFactory } from '../build/types/LiquidatorUniswapChangeFactory'
import { setupDeploy, txnArgs, validatePrivateKey } from './utils'

async function deployLiquidator (accountPrivateKey: string, provider: JsonRpcProvider) {
  validatePrivateKey(accountPrivateKey)
  const wallet = new ethers.Wallet(accountPrivateKey, provider)
  const deploy = setupDeploy(wallet)
  const liquidatorResetImplementation = await deploy(LiquidatorUniswapChangeFactory, txnArgs)
  console.log(`Deployed LiquidatorUniswapChange at: ${liquidatorResetImplementation.address}`)
}

if (require.main === module) {
  if (!['mainnet', 'kovan', 'ropsten', 'rinkeby'].includes(process.argv[3])) {
    throw new Error(`Unknown network: ${process.argv[3]}`)
  }

  const provider = new ethers.providers.InfuraProvider(process.argv[3], '81447a33c1cd4eb09efb1e8c388fb28e')
  deployLiquidator(process.env.PRIVATE_KEY, provider)
    .catch(console.error)
}
