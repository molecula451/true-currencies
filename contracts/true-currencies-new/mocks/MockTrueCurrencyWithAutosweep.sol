// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.6.10;

import {TrueCurrencyWithLegacyAutosweep} from "../TrueCurrencyWithLegacyAutosweep.sol";

contract MockTrueCurrencyWithAutosweep is TrueCurrencyWithLegacyAutosweep {
    uint8 constant DECIMALS = 18;
    uint8 constant ROUNDING = 2;

    function initialize() external {
        require(!initialized);
        owner = msg.sender;
        initialized = true;
    }

    function decimals() public override pure returns (uint8) {
        return DECIMALS;
    }

    function rounding() public pure returns (uint8) {
        return ROUNDING;
    }

    function name() public override pure returns (string memory) {
        return "TrueCurrency";
    }

    function symbol() public override pure returns (string memory) {
        return "TCUR";
    }
}