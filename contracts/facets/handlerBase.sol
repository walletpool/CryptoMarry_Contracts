// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./IERC20Usdt.sol";


abstract contract HandlerBase {
    using SafeERC20 for IERC20;

    address public constant NATIVE_TOKEN_ADDRESS =
        0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;

    function _uint2String(uint256 n) internal pure returns (string memory) {
        if (n == 0) {
            return "0";
        } else {
            uint256 len = 0;
            for (uint256 temp = n; temp > 0; temp /= 10) {
                len++;
            }
            bytes memory str = new bytes(len);
            for (uint256 i = len; i > 0; i--) {
                str[i - 1] = bytes1(uint8(48 + (n % 10)));
                n /= 10;
            }
            return string(str);
        }
    }

    function _getBalance(address token, uint256 amount)
        internal
        view
        returns (uint256)
    {
        if (amount != type(uint256).max) {
            return amount;
        }

        // ETH case
        if (token == address(0) || token == NATIVE_TOKEN_ADDRESS) {
            return address(this).balance;
        }
        // ERC20 token case
        return IERC20(token).balanceOf(address(this));
    }

    function _tokenApprove(
        address token,
        address spender,
        uint256 amount
    ) internal {
        try IERC20Usdt(token).approve(spender, amount) {} catch {
            IERC20(token).safeApprove(spender, 0);
            IERC20(token).safeApprove(spender, amount);
        }
    }

    function _tokenApproveZero(address token, address spender) internal {
        if (IERC20Usdt(token).allowance(address(this), spender) > 0) {
            try IERC20Usdt(token).approve(spender, 0) {} catch {
                IERC20Usdt(token).approve(spender, 1);
            }
        }
    }

    function _isNotNativeToken(address token) internal pure returns (bool) {
        return (token != address(0) && token != NATIVE_TOKEN_ADDRESS);
    }
}