import { Wallet } from 'ethers'
import { beforeEachWithFixture } from './utils/beforeEachWithFixture'
import { setupDeploy } from '../scripts/utils'
import { TrustTokenFactory } from '../build/types/TrustTokenFactory'
import { TrustToken } from '../build/types/TrustToken'
import { TimeLockRegistryFactory } from '../build/types/TimeLockRegistryFactory'
import { TimeLockRegistry } from '../build/types/TimeLockRegistry'
import { OwnedUpgradeabilityProxyFactory } from '../build/types/OwnedUpgradeabilityProxyFactory'

import { expect, use } from 'chai'
import { solidity } from 'ethereum-waffle'
import { parseTT } from './utils/parseTT'

import { AddressZero } from 'ethers/constants'
import { expectEvent } from './utils/eventHelpers'
import { RegistryFactory } from '../build/types/RegistryFactory'

use(solidity)

describe('TimeLockRegistry', () => {
  let owner: Wallet, holder: Wallet, another: Wallet
  let timeLockRegistry: TimeLockRegistry
  let trustToken: TrustToken

  beforeEachWithFixture(async (provider, wallets) => {
    ([owner, holder, another] = wallets)
    const deployContract = setupDeploy(owner)
    trustToken = await deployContract(TrustTokenFactory)
    const registry = await deployContract(RegistryFactory)
    await trustToken.initialize(registry.address)
    await trustToken.mint(owner.address, parseTT(1000))
    const proxy = await deployContract(OwnedUpgradeabilityProxyFactory)
    const registryImpl = await deployContract(TimeLockRegistryFactory)
    await proxy.upgradeTo(registryImpl.address)
    timeLockRegistry = TimeLockRegistryFactory.connect(proxy.address, owner)
    await timeLockRegistry.initialize(trustToken.address)
    await trustToken.setTimeLockRegistry(timeLockRegistry.address)
  })

  it('cannot be initialized twice', async () => {
    await expect(timeLockRegistry.initialize(trustToken.address)).to.be.revertedWith('Already initialized')
  })

  describe('Register', () => {
    it('non-owner cannot register accounts', async () => {
      await expect(timeLockRegistry.connect(holder).register(holder.address, 1)).to.be.revertedWith('only owner')
    })

    it('cannot register if allowance is too small', async () => {
      await trustToken.approve(timeLockRegistry.address, 9)
      await expect(timeLockRegistry.register(holder.address, 10)).to.be.revertedWith('insufficient allowance')
    })

    it('adds recipient to distributions list', async () => {
      await trustToken.approve(timeLockRegistry.address, parseTT(10))
      // event emitted correctly
      const tx = await timeLockRegistry.register(holder.address, parseTT(10))

      await expectEvent(timeLockRegistry, 'Register')(tx, holder.address, parseTT(10))

      expect(await timeLockRegistry.registeredDistributions(holder.address)).to.equal(parseTT(10))
      expect(await trustToken.balanceOf(owner.address)).to.equal(parseTT(990))
      expect(await trustToken.balanceOf(timeLockRegistry.address)).to.equal(parseTT(10))
    })

    it('cannot register same address twice', async () => {
      await trustToken.approve(timeLockRegistry.address, parseTT(10))
      await timeLockRegistry.register(holder.address, parseTT(5))
      await expect(timeLockRegistry.register(holder.address, parseTT(5))).to.be.revertedWith('Distribution for this address is already registered')
    })

    it('cannot register distribution for zero address', async () => {
      await expect(timeLockRegistry.register(AddressZero, parseTT(5))).to.be.revertedWith('Zero address')
    })

    it('cannot register zero distribution', async () => {
      await expect(timeLockRegistry.register(holder.address, 0)).to.be.revertedWith('Distribution = 0')
    })
  })

  describe('Cancel', () => {
    it('cancels registration', async () => {
      await trustToken.approve(timeLockRegistry.address, parseTT(10))
      await timeLockRegistry.register(holder.address, parseTT(10))
      const tx = await timeLockRegistry.cancel(holder.address)

      await expectEvent(timeLockRegistry, 'Cancel')(tx, holder.address, parseTT(10))

      expect(await timeLockRegistry.registeredDistributions(holder.address)).to.equal(0)
      expect(await trustToken.balanceOf(owner.address)).to.equal(parseTT(1000))
      expect(await trustToken.balanceOf(timeLockRegistry.address)).to.equal(0)
    })

    it('cancel one of 2 registrations', async () => {
      await trustToken.approve(timeLockRegistry.address, parseTT(10))
      await timeLockRegistry.register(holder.address, parseTT(5))
      await timeLockRegistry.register(another.address, parseTT(5))
      await timeLockRegistry.cancel(holder.address)

      expect(await timeLockRegistry.registeredDistributions(holder.address)).to.equal(0)
      expect(await timeLockRegistry.registeredDistributions(another.address)).to.equal(parseTT(5))
      expect(await trustToken.balanceOf(owner.address)).to.equal(parseTT(995))
      expect(await trustToken.balanceOf(timeLockRegistry.address)).to.equal(parseTT(5))
    })

    it('cannot cancel by non-owner', async () => {
      await expect(timeLockRegistry.connect(holder).cancel(holder.address)).to.be.revertedWith('only owner')
    })

    it('cannot cancel not registered address', async () => {
      await expect(timeLockRegistry.cancel(holder.address)).to.be.revertedWith('Not registered')
    })
  })

  describe('Claim', () => {
    it('cannot claim if not registered', async () => {
      await expect(timeLockRegistry.claim()).to.be.revertedWith('Not registered')
    })

    it('transfers funds to registered address', async () => {
      await trustToken.approve(timeLockRegistry.address, parseTT(10))
      await timeLockRegistry.register(holder.address, parseTT(10))
      const tx = await timeLockRegistry.connect(holder).claim()

      await expectEvent(timeLockRegistry, 'Claim')(tx, holder.address, parseTT(10))

      expect(await timeLockRegistry.registeredDistributions(holder.address)).to.equal(0)
      expect(await trustToken.balanceOf(owner.address)).to.equal(parseTT(990))
      expect(await trustToken.balanceOf(timeLockRegistry.address)).to.equal(0)
      expect(await trustToken.balanceOf(holder.address)).to.equal(parseTT(10))
      expect(await trustToken.lockedBalance(holder.address)).to.equal(parseTT(10))
    })

    it('cannot claim twice', async () => {
      await trustToken.approve(timeLockRegistry.address, parseTT(10))
      await timeLockRegistry.register(holder.address, parseTT(10))
      await timeLockRegistry.connect(holder).claim()
      await expect(timeLockRegistry.connect(holder).claim()).to.be.revertedWith('Not registered')
    })

    it('cannot claim after cancel', async () => {
      await trustToken.approve(timeLockRegistry.address, parseTT(10))
      await timeLockRegistry.register(holder.address, parseTT(10))
      await timeLockRegistry.cancel(holder.address)
      await expect(timeLockRegistry.connect(holder).claim()).to.be.revertedWith('Not registered')
    })
  })
})
