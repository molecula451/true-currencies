import { ethers, providers } from 'ethers'
import { MockTrustTokenFactory } from '../build/types/MockTrustTokenFactory'
import { formatEther, parseEther } from 'ethers/utils'
import { expect, use } from 'chai'
import { solidity } from 'ethereum-waffle'
import { StakedTokenFactory } from '../build/types/StakedTokenFactory'
import { RegistryImplementationFactory } from '../build/types/RegistryImplementationFactory'
import { AaveFinancialOpportunityFactory } from '../build/types/AaveFinancialOpportunityFactory'
import { AssuredFinancialOpportunityFactory } from '../build/types/AssuredFinancialOpportunityFactory'
import { ATokenFactory } from '../build/types/ATokenFactory'
import addresses from './deploy/ropsten.json'
import { TrueUsdFactory } from '../build/types/TrueUsdFactory'
import { RegistryAttributes } from './attributes'
import { TokenFaucetFactory } from '../build/types/TokenFaucetFactory'
import { LiquidatorFactory } from '../build/types/LiquidatorFactory'
import { LendingPoolFactory } from '../build/types/LendingPoolFactory'
import { LendingPoolCoreFactory } from '../build/types/LendingPoolCoreFactory'

use(solidity)

const wait = async <T>(tx: Promise<{wait: () => Promise<T>}>): Promise<T> => (await tx).wait()
const TRU1000 = parseEther('1000').div(1e10)

describe('ropsten test', function () {
  this.timeout(10000000)
  const provider = new providers.InfuraProvider('ropsten', '81447a33c1cd4eb09efb1e8c388fb28e')
  // const provider = new providers.JsonRpcProvider('https://ropsten-rpc.linkpool.io/')
  // expected to have some tUSD
  const staker = new ethers.Wallet(process.env.STAKER_KEY, provider)
  // expected to have no tUSD
  const brokePerson = new ethers.Wallet(process.env.EMPTY_WALLET_KEY, provider)
  const owner = new ethers.Wallet(process.env.OWNER_KEY, provider)
  const tusd = TrueUsdFactory.connect(addresses.trueUSD, owner)
  const faucet = TokenFaucetFactory.connect(addresses.tokenController, owner)
  const stakedToken = StakedTokenFactory.connect(addresses.stakedToken, owner)
  const registry = RegistryImplementationFactory.connect(addresses.registry, owner)
  const trustToken = MockTrustTokenFactory.connect(addresses.trustToken, owner)
  const atoken = ATokenFactory.connect(addresses.aToken, owner)
  const lendingPool = LendingPoolFactory.connect(addresses.lendingPool, owner)
  const aaveFinancialOpportunity = AaveFinancialOpportunityFactory.connect(addresses.financialOpportunity, owner)
  const assuredFinancialOpportunity = AssuredFinancialOpportunityFactory.connect(addresses.assuredFinancialOpportunity, owner)
  const liquidator = LiquidatorFactory.connect(addresses.liquidator, owner)

  it('trueRewards enable-disable with 0 balance', async () => {
    expect(await tusd.balanceOf(brokePerson.address)).to.equal(0)
    expect(await tusd.trueRewardEnabled(brokePerson.address)).to.be.false
    await wait(registry.setAttributeValue(brokePerson.address, RegistryAttributes.isTrueRewardsWhitelisted.hex, 1))
    await wait(tusd.connect(brokePerson).enableTrueReward({ gasLimit: 100000 }))
    await wait(tusd.connect(brokePerson).disableTrueReward({ gasLimit: 100000 }))
  })

  it('trueRewards enable-disable with some balance', async () => {
    await wait(faucet.connect(staker).faucet(parseEther('1000'), { gasLimit: 1000000 }))
    expect(await tusd.balanceOf(staker.address)).to.be.gte(parseEther('1000'))
    expect(await tusd.trueRewardEnabled(staker.address)).to.be.false
    await wait(registry.setAttributeValue(staker.address, RegistryAttributes.isTrueRewardsWhitelisted.hex, 1, { gasLimit: 1000000 }))
    await wait(tusd.connect(staker).enableTrueReward({ gasLimit: 1000000 }))
    await wait(tusd.connect(staker).disableTrueReward({ gasLimit: 1000000 }))
  })

  it('disabled -> enabled', async () => {
    await wait(tusd.connect(staker).enableTrueReward({ gasLimit: 1000000 }))
    await wait(faucet.connect(brokePerson).faucet(10))
    expect(await tusd.trueRewardEnabled(brokePerson.address)).to.be.false
    const receiverBalanceBefore = await tusd.balanceOf(staker.address)
    await wait(tusd.connect(brokePerson).transfer(staker.address, 10, { gasLimit: 1000000 }))
    expect(await tusd.balanceOf(brokePerson.address)).to.equal(0)
    expect(await tusd.balanceOf(staker.address)).to.be.gte(receiverBalanceBefore.add(10))
    await wait(tusd.connect(staker).disableTrueReward({ gasLimit: 5000000 }))
  })

  it('enabled -> enabled', async () => {
    await wait(tusd.connect(staker).enableTrueReward({ gasLimit: 1000000 }))
    await wait(faucet.connect(brokePerson).faucet(10, { gasLimit: 1000000 }))
    await wait(tusd.connect(brokePerson).enableTrueReward({ gasLimit: 1000000 }))
    const receiverBalanceBefore = await tusd.balanceOf(staker.address)
    await wait(tusd.connect(brokePerson).transfer(staker.address, await tusd.balanceOf(brokePerson.address), { gasLimit: 2000000 }))
    // 1 wei error here
    expect(await tusd.balanceOf(brokePerson.address)).to.be.lte(1)
    expect(await tusd.balanceOf(staker.address)).to.be.gte(receiverBalanceBefore.add(9))
    await wait(tusd.connect(brokePerson).disableTrueReward({ gasLimit: 1000000 }))
    await wait(tusd.connect(staker).disableTrueReward({ gasLimit: 5000000 }))
  })

  it('enabled -> disabled', async () => {
    await wait(tusd.connect(staker).enableTrueReward({ gasLimit: 1000000 }))
    expect(await tusd.trueRewardEnabled(brokePerson.address)).to.be.false
    expect(await tusd.trueRewardEnabled(staker.address)).to.be.true
    await wait(tusd.connect(brokePerson).transfer(staker.address, await tusd.balanceOf(brokePerson.address), { gasLimit: 2000000 }))
    const receiverBalanceBefore = await tusd.balanceOf(staker.address)
    await wait(tusd.connect(staker).transfer(brokePerson.address, parseEther('1'), { gasLimit: 2000000 }))
    expect(await tusd.balanceOf(brokePerson.address)).to.equal(parseEther('1').sub(1))
    expect(await tusd.balanceOf(staker.address)).to.be.lte(receiverBalanceBefore.sub(parseEther('0.99')))
    await wait(tusd.connect(brokePerson).transfer(staker.address, await tusd.balanceOf(brokePerson.address), { gasLimit: 2000000 }))
    await wait(tusd.connect(staker).disableTrueReward({ gasLimit: 5000000 }))
  })

  it('disabled -> disabled', async () => {
    const receiverBalanceBefore = await tusd.balanceOf('0xE73B9F4b99CAC17723192D457234A27E7a8fBC01')
    await wait(faucet.connect(brokePerson).faucet(10, { gasLimit: 1000000 }))
    await wait(tusd.connect(brokePerson).transfer('0xE73B9F4b99CAC17723192D457234A27E7a8fBC01', await tusd.balanceOf(brokePerson.address), { gasLimit: 1000000 }))
    expect(await tusd.balanceOf(brokePerson.address)).to.equal(0)
    expect(await tusd.balanceOf('0xE73B9F4b99CAC17723192D457234A27E7a8fBC01')).to.equal(receiverBalanceBefore.add(10))
  })

  describe('Staking', () => {
    it('Account stakes TRU on opportunity', async () => {
      await wait(trustToken.connect(staker).approve(stakedToken.address, TRU1000))
      await wait(trustToken.faucet(staker.address, TRU1000))
      await wait(stakedToken.connect(staker).deposit(TRU1000))

      expect(await trustToken.balanceOf(stakedToken.address)).to.eq(TRU1000)
      expect(await stakedToken.totalSupply()).to.eq(TRU1000.mul(1000))
      expect(await stakedToken.balanceOf(staker.address)).to.equal(TRU1000.mul(1000))

      await wait(faucet.faucet(parseEther('100'), { gasLimit: 2000000 }))
      await wait(tusd.connect(owner).enableTrueReward({ gasLimit: 2000000 }))
      const lendingPoolCore = LendingPoolCoreFactory.connect(await lendingPool.core(), owner)
      await wait(faucet.connect(brokePerson).faucet(parseEther('50'), { gasLimit: 1000000 }))
      await wait(tusd.connect(brokePerson).approve(lendingPoolCore.address, parseEther('50')))
      await wait(lendingPool.connect(brokePerson).deposit(tusd.address, parseEther('50'), 0, { gasLimit: 5000000 }))
      await wait(lendingPool.connect(brokePerson).borrow(tusd.address, parseEther('5'), 2, 0, { gasLimit: 5000000 }))
      await wait(assuredFinancialOpportunity.setRewardBasis(700))

      console.log(formatEther(await assuredFinancialOpportunity.poolAwardBalance()))
    })

    it('finalize unstake', async () => {
      const { blockNumber } = await wait(stakedToken.connect(staker).initUnstake(await stakedToken.balanceOf(staker.address)))
      const { timestamp } = await provider.getBlock(blockNumber)
      await wait(stakedToken.connect(staker).finalizeUnstake(staker.address, [timestamp], { gasLimit: 5000000 }))
      console.log(formatEther(await stakedToken.balanceOf(staker.address)))
    })

    it('stakes multiple times', async () => {
      await wait(trustToken.connect(staker).transfer(stakedToken.address, (await trustToken.balanceOf(staker.address)).div(2)))
      await wait(trustToken.connect(staker).transfer(stakedToken.address, await trustToken.balanceOf(staker.address)))
      const balance = await stakedToken.balanceOf(staker.address)
      const { blockNumber: bn1 } = await wait(stakedToken.connect(staker).initUnstake(balance.div(2)))
      const { timestamp: t1 } = await staker.provider.getBlock(bn1)
      const { blockNumber: bn2 } = await wait(stakedToken.connect(staker).initUnstake(balance.div(2)))
      const { timestamp: t2 } = await staker.provider.getBlock(bn2)
      await wait(stakedToken.connect(staker).finalizeUnstake(staker.address, [1595417523, 1595417597], { gasLimit: 5000000 }))
      console.log((await trustToken.balanceOf(staker.address)).toString())
    })

    it('staker receives reward', async () => {
      await wait(trustToken.connect(staker).transfer(stakedToken.address, await trustToken.balanceOf(staker.address)))
      expect(await stakedToken.unclaimedRewards(staker.address)).to.equal(0)
      console.log((await assuredFinancialOpportunity.poolAwardBalance()).toString())
      await wait(assuredFinancialOpportunity.awardPool({ gasLimit: 3000000 }))
      console.log((await stakedToken.unclaimedRewards(staker.address)).toString())
      await wait(stakedToken.connect(staker).claimRewards(staker.address, { gasLimit: 3000000, gasPrice: 50000000000 }))
    })

    it('stake transfer', async () => {
      await wait(trustToken.faucet(staker.address, TRU1000, { gasLimit: 3000000, gasPrice: 50000000000 }))
      await wait(trustToken.connect(staker).transfer(stakedToken.address, await trustToken.balanceOf(staker.address), { gasLimit: 3000000, gasPrice: 50000000000 }))
      await wait(stakedToken.connect(staker).transfer(brokePerson.address, (await stakedToken.balanceOf(staker.address)).div(3), { gasLimit: 3000000, gasPrice: 50000000000 }))
      await wait(assuredFinancialOpportunity.awardPool({ gasLimit: 3000000, gasPrice: 50000000000 }))
      console.log((await stakedToken.unclaimedRewards(staker.address)).toString())
      console.log((await stakedToken.unclaimedRewards(brokePerson.address)).toString())
    })
  })
})
