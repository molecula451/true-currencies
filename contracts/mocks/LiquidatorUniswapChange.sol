pragma solidity 0.5.13;

import "@trusttoken/trusttokens/contracts/Liquidator.sol";

contract LiquidatorUniswapChange is Liquidator {

    function setStakeUniswap() external {
        // TODO provide correct address for TrustToken uniswap exchange
        stakeUniswap_ = UniswapV1(address(0));
    }
}
