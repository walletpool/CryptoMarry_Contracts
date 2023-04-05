// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import {VoteProposalLib} from "../../libraries/VotingStatusLib.sol";
import {IDiamondCut} from "../../interfaces/IDiamondCut.sol";
import {LibDiamond} from "../../libraries/LibDiamond.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "@gnus.ai/contracts-upgradeable-diamond/metatx/MinimalForwarderUpgradeable.sol";
import "@gnus.ai/contracts-upgradeable-diamond/metatx/ERC2771ContextUpgradeable.sol";
import "../handlerBase.sol";
import "./IWrappedNativeToken.sol";
import "./BytesLib.sol";
import "./ISwapRouter.sol";

contract UniSwapV3Facet is ERC2771ContextUpgradeable, HandlerBase {
    using SafeERC20 for IERC20;
    using BytesLib for bytes;

    error COULD_NOT_PROCESS(string);
    ISwapRouter public immutable ROUTER;
    IWrappedNativeToken public immutable wrappedNativeTokenUV3;

    uint256 private constant PATH_SIZE = 43; // address + address + uint24
    uint256 private constant ADDRESS_SIZE = 20;

    constructor(
        MinimalForwarderUpgradeable forwarder,
        ISwapRouter _ROUTER,
        address wrappedNativeToken_
    ) ERC2771ContextUpgradeable(address(forwarder)) {
        ROUTER = _ROUTER;
        wrappedNativeTokenUV3 = IWrappedNativeToken(wrappedNativeToken_);
    }

    function executeUniSwap(
        uint256 _id,
        uint256 amountOutMinimum,
        uint24 fee,
        uint160 sqrtPriceLimitX96
    ) external {
        address msgSender_ = _msgSender();
        VoteProposalLib.enforceMarried();
        VoteProposalLib.enforceUserHasAccess(msgSender_);
        VoteProposalLib.enforceAcceptedStatus(_id);
        VoteProposalLib.VoteTracking storage vt = VoteProposalLib
            .VoteTrackingStorage();

        uint256 amountIn = vt.voteProposalAttributes[_id].amount;

        //exactInputSingleFromEther
        if (vt.voteProposalAttributes[_id].voteType == 101) {
            vt.voteProposalAttributes[_id].voteStatus = 101;

            // Build params for router call
            ISwapRouter.ExactInputSingleParams memory params;
            params.tokenIn = address(wrappedNativeTokenUV3);
            params.tokenOut = vt.voteProposalAttributes[_id].receiver;
            params.fee = fee;
            params.amountIn = _getBalance(address(0), amountIn);
            params.amountOutMinimum = amountOutMinimum;
            params.sqrtPriceLimitX96 = sqrtPriceLimitX96;

            uint256 amountOut = _exactInputSingle(params.amountIn, params);

            emit VoteProposalLib.AddStake(
                address(this),
                address(ROUTER),
                block.timestamp,
                amountOut
            );

            //exactInputSingleToEther
        } else if (vt.voteProposalAttributes[_id].voteType == 102) {
            vt.voteProposalAttributes[_id].voteStatus = 102;
            ISwapRouter.ExactInputSingleParams memory params;
            address tokenIn = vt.voteProposalAttributes[_id].tokenID;
            params.tokenIn = tokenIn;
            params.tokenOut = address(wrappedNativeTokenUV3);
            params.fee = fee;
            params.amountIn = _getBalance(tokenIn, amountIn);
            params.amountOutMinimum = amountOutMinimum;
            params.sqrtPriceLimitX96 = sqrtPriceLimitX96;

            // Approve token
            _tokenApprove(tokenIn, address(ROUTER), params.amountIn);
            uint256 amountOut = _exactInputSingle(0, params);
            _tokenApproveZero(tokenIn, address(ROUTER));
            wrappedNativeTokenUV3.withdraw(amountOut);

            ///exactInputSingle
        } else if (vt.voteProposalAttributes[_id].voteType == 103) {
            vt.voteProposalAttributes[_id].voteStatus = 103;

            address tokenIn = vt.voteProposalAttributes[_id].tokenID;
            address tokenOut = vt.voteProposalAttributes[_id].receiver;

            // Build params for router call
            ISwapRouter.ExactInputSingleParams memory params;
            params.tokenIn = tokenIn;
            params.tokenOut = tokenOut;
            params.fee = fee;
            params.amountIn = _getBalance(tokenIn, amountIn);
            params.amountOutMinimum = amountOutMinimum;
            params.sqrtPriceLimitX96 = sqrtPriceLimitX96;

            // Approve token
            _tokenApprove(tokenIn, address(ROUTER), params.amountIn);
            _exactInputSingle(0, params);
            _tokenApproveZero(tokenIn, address(ROUTER));

            //exactInputFromEther
        } else revert COULD_NOT_PROCESS("Not Uniswap Type");

        emit VoteProposalLib.VoteStatus(
            _id,
            msgSender_,
            vt.voteProposalAttributes[_id].voteStatus,
            block.timestamp
        );
        VoteProposalLib.checkForwarder();
    }

    function executeUniSwapMulti(
        uint256 _id,
        bytes memory path,
        uint256 amountOutMinimum
    ) external {
        address msgSender_ = _msgSender();
        VoteProposalLib.enforceMarried();
        VoteProposalLib.enforceUserHasAccess(msgSender_);
        VoteProposalLib.enforceAcceptedStatus(_id);
        VoteProposalLib.VoteTracking storage vt = VoteProposalLib
            .VoteTrackingStorage();

        uint256 amountIn = vt.voteProposalAttributes[_id].amount;

        //exactInputFromEther
        if (vt.voteProposalAttributes[_id].voteType == 104) {
            vt.voteProposalAttributes[_id].voteStatus = 104;

            address tokenIn = vt.voteProposalAttributes[_id].tokenID;
            address tokenOut = vt.voteProposalAttributes[_id].receiver;

            if (
                tokenIn != _getFirstToken(path) ||
                tokenIn != address(wrappedNativeTokenUV3)
            ) revert COULD_NOT_PROCESS("Wrong path");
            if (tokenOut != _getLastToken(path))
                revert COULD_NOT_PROCESS("Wrong path");

            // Build params for router call
            ISwapRouter.ExactInputParams memory params;
            params.path = path;
            params.amountIn = _getBalance(address(0), amountIn);
            params.amountOutMinimum = amountOutMinimum;

            uint256 amountOut = _exactInput(params.amountIn, params);

            emit VoteProposalLib.AddStake(
                address(this),
                address(ROUTER),
                block.timestamp,
                amountOut
            );

            //exactInputToEther
        } else if (vt.voteProposalAttributes[_id].voteType == 105) {
            vt.voteProposalAttributes[_id].voteStatus = 105;

            address tokenIn = vt.voteProposalAttributes[_id].tokenID;
            address tokenOut = vt.voteProposalAttributes[_id].receiver;

            if (tokenIn != _getFirstToken(path))
                revert COULD_NOT_PROCESS("Wrong path");
            if (
                tokenOut != _getLastToken(path) ||
                tokenOut != address(wrappedNativeTokenUV3)
            ) revert COULD_NOT_PROCESS("Wrong path");

            // Build params for router call
            ISwapRouter.ExactInputParams memory params;
            params.path = path;
            params.amountIn = _getBalance(tokenIn, amountIn);
            params.amountOutMinimum = amountOutMinimum;

            // Approve token
            _tokenApprove(tokenIn, address(ROUTER), params.amountIn);
            uint256 amountOut = _exactInput(0, params);
            _tokenApproveZero(tokenIn, address(ROUTER));
            wrappedNativeTokenUV3.withdraw(amountOut);

            ///exactInput
        } else if (vt.voteProposalAttributes[_id].voteType == 106) {
            vt.voteProposalAttributes[_id].voteStatus = 106;

            address tokenIn = vt.voteProposalAttributes[_id].tokenID;
            address tokenOut = vt.voteProposalAttributes[_id].receiver;

            if (tokenIn != _getFirstToken(path))
                revert COULD_NOT_PROCESS("Wrong path");
            if (tokenOut != _getLastToken(path))
                revert COULD_NOT_PROCESS("Wrong path");

            // Build params for router call
            ISwapRouter.ExactInputParams memory params;
            params.path = path;
            params.amountIn = _getBalance(tokenIn, amountIn);
            params.amountOutMinimum = amountOutMinimum;

            // Approve token
            _tokenApprove(tokenIn, address(ROUTER), params.amountIn);
            _exactInput(0, params);
            _tokenApproveZero(tokenIn, address(ROUTER));
        } else revert COULD_NOT_PROCESS("Not Uniswap Type");

        emit VoteProposalLib.VoteStatus(
            _id,
            msgSender_,
            vt.voteProposalAttributes[_id].voteStatus,
            block.timestamp
        );
        VoteProposalLib.checkForwarder();
    }

    function executeUniSwapOutput(
        uint256 _id,
        uint256 amountInMaximum,
        uint24 fee,
        uint160 sqrtPriceLimitX96
    ) external {
        address msgSender_ = _msgSender();
        VoteProposalLib.enforceMarried();
        VoteProposalLib.enforceUserHasAccess(msgSender_);
        VoteProposalLib.enforceAcceptedStatus(_id);
        VoteProposalLib.VoteTracking storage vt = VoteProposalLib
            .VoteTrackingStorage();

        uint256 amountOut = vt.voteProposalAttributes[_id].amount;

        //exactOutputSingleFromEther
        if (vt.voteProposalAttributes[_id].voteType == 107) {
            vt.voteProposalAttributes[_id].voteStatus = 107;

            // Build params for router call
            ISwapRouter.ExactOutputSingleParams memory params;
            params.tokenIn = address(wrappedNativeTokenUV3);
            params.tokenOut = vt.voteProposalAttributes[_id].receiver;
            params.fee = fee;
            params.amountOut = amountOut;
            // if amount == type(uint256).max return balance of Proxy
            params.amountInMaximum = _getBalance(address(0), amountInMaximum);
            params.sqrtPriceLimitX96 = sqrtPriceLimitX96;

            _exactOutputSingle(params.amountInMaximum, params);
            ROUTER.refundETH();

            emit VoteProposalLib.AddStake(
                address(this),
                address(ROUTER),
                block.timestamp,
                amountOut
            );

            //exactOutputSingleToEther
        } else if (vt.voteProposalAttributes[_id].voteType == 108) {
            vt.voteProposalAttributes[_id].voteStatus = 108;
            // Build params for router call
            address tokenIn = vt.voteProposalAttributes[_id].tokenID;

            ISwapRouter.ExactOutputSingleParams memory params;
            params.tokenIn = tokenIn;
            params.tokenOut = address(wrappedNativeTokenUV3);
            params.fee = fee;
            params.amountOut = amountOut;
            // if amount == type(uint256).max return balance of Proxy
            params.amountInMaximum = _getBalance(tokenIn, amountInMaximum);
            params.sqrtPriceLimitX96 = sqrtPriceLimitX96;

            // Approve token
            _tokenApprove(
                params.tokenIn,
                address(ROUTER),
                params.amountInMaximum
            );
            _exactOutputSingle(0, params);
            _tokenApproveZero(params.tokenIn, address(ROUTER));
            wrappedNativeTokenUV3.withdraw(params.amountOut);

            ///exactOutputSingle
        } else if (vt.voteProposalAttributes[_id].voteType == 109) {
            vt.voteProposalAttributes[_id].voteStatus = 109;

            address tokenIn = vt.voteProposalAttributes[_id].tokenID;
            address tokenOut = vt.voteProposalAttributes[_id].receiver;

            // Build params for router call
            ISwapRouter.ExactOutputSingleParams memory params;
            params.tokenIn = tokenIn;
            params.tokenOut = tokenOut;
            params.fee = fee;
            params.amountOut = amountOut;
            // if amount == type(uint256).max return balance of Proxy
            params.amountInMaximum = _getBalance(tokenIn, amountInMaximum);
            params.sqrtPriceLimitX96 = sqrtPriceLimitX96;

            // Approve token
            _tokenApprove(
                params.tokenIn,
                address(ROUTER),
                params.amountInMaximum
            );
            _exactOutputSingle(0, params);
            _tokenApproveZero(params.tokenIn, address(ROUTER));
        } else revert COULD_NOT_PROCESS("Not output Type");

        emit VoteProposalLib.VoteStatus(
            _id,
            msgSender_,
            vt.voteProposalAttributes[_id].voteStatus,
            block.timestamp
        );
        VoteProposalLib.checkForwarder();
    }

    function executeUniSwapMultiOutput(
        uint256 _id,
        bytes memory path,
        uint256 amountInMaximum
    ) external {
        address msgSender_ = _msgSender();
        VoteProposalLib.enforceMarried();
        VoteProposalLib.enforceUserHasAccess(msgSender_);
        VoteProposalLib.enforceAcceptedStatus(_id);
        VoteProposalLib.VoteTracking storage vt = VoteProposalLib
            .VoteTrackingStorage();

        uint256 amountOut = vt.voteProposalAttributes[_id].amount;

        //exactOutputFromEther
        if (vt.voteProposalAttributes[_id].voteType == 110) {
            vt.voteProposalAttributes[_id].voteStatus = 110;

            address tokenIn = vt.voteProposalAttributes[_id].tokenID;
            address tokenOut = vt.voteProposalAttributes[_id].receiver;

            if (
                tokenIn != _getFirstToken(path) ||
                tokenIn != address(wrappedNativeTokenUV3)
            ) revert COULD_NOT_PROCESS("Wrong path");
            if (tokenOut != _getLastToken(path))
                revert COULD_NOT_PROCESS("Wrong path");

            // Build params for router call
            ISwapRouter.ExactOutputParams memory params;
            params.path = path;
            params.amountOut = amountOut;
            params.amountInMaximum = _getBalance(address(0), amountInMaximum);

            _exactOutput(params.amountInMaximum, params);
            ROUTER.refundETH();

            emit VoteProposalLib.AddStake(
                address(this),
                address(ROUTER),
                block.timestamp,
                amountOut
            );

            //exactOutputToEther
        } else if (vt.voteProposalAttributes[_id].voteType == 111) {
            vt.voteProposalAttributes[_id].voteStatus = 111;

            address tokenIn = vt.voteProposalAttributes[_id].tokenID;
            address tokenOut = vt.voteProposalAttributes[_id].receiver;

            if (tokenIn != _getFirstToken(path))
                revert COULD_NOT_PROCESS("Wrong path");
            if (
                tokenOut != _getLastToken(path) ||
                tokenOut != address(wrappedNativeTokenUV3)
            ) revert COULD_NOT_PROCESS("Wrong path");

            // Build params for router call
            ISwapRouter.ExactOutputParams memory params;
            params.path = path;
            params.amountOut = amountOut;
            // if amount == type(uint256).max return balance of Proxy
            params.amountInMaximum = _getBalance(tokenIn, amountInMaximum);

            // Approve token
            _tokenApprove(tokenIn, address(ROUTER), params.amountInMaximum);
            _exactOutput(0, params);
            _tokenApproveZero(tokenIn, address(ROUTER));
            wrappedNativeTokenUV3.withdraw(amountOut);

            ///exactOutput
        } else if (vt.voteProposalAttributes[_id].voteType == 112) {
            vt.voteProposalAttributes[_id].voteStatus = 112;

            address tokenIn = vt.voteProposalAttributes[_id].tokenID;
            address tokenOut = vt.voteProposalAttributes[_id].receiver;

            if (tokenIn != _getFirstToken(path))
                revert COULD_NOT_PROCESS("Wrong path");
            if (tokenOut != _getLastToken(path))
                revert COULD_NOT_PROCESS("Wrong path");

            // Build params for router call
            ISwapRouter.ExactOutputParams memory params;
            params.path = path;
            params.amountOut = amountOut;
            // if amount == type(uint256).max return balance of Proxy
            params.amountInMaximum = _getBalance(tokenIn, amountInMaximum);
            // Approve token
            _tokenApprove(tokenIn, address(ROUTER), params.amountInMaximum);
            _exactOutput(0, params);
            _tokenApproveZero(tokenIn, address(ROUTER));
        } else revert COULD_NOT_PROCESS("Not Uniswap Type");

        emit VoteProposalLib.VoteStatus(
            _id,
            msgSender_,
            vt.voteProposalAttributes[_id].voteStatus,
            block.timestamp
        );
        VoteProposalLib.checkForwarder();
    }

    function _exactInputSingle(
        uint256 value,
        ISwapRouter.ExactInputSingleParams memory params
    ) internal returns (uint256) {
        params.deadline = block.timestamp;
        params.recipient = address(this);

        try ROUTER.exactInputSingle{value: value}(params) returns (
            uint256 amountOut
        ) {
            return amountOut;
        } catch Error(string memory reason) {
            revert COULD_NOT_PROCESS(reason);
        } catch {
            revert COULD_NOT_PROCESS("exactInputSingle");
        }
    }

    function _exactInput(
        uint256 value,
        ISwapRouter.ExactInputParams memory params
    ) internal returns (uint256) {
        params.deadline = block.timestamp;
        params.recipient = address(this);

        try ROUTER.exactInput{value: value}(params) returns (
            uint256 amountOut
        ) {
            return amountOut;
        } catch Error(string memory reason) {
            revert COULD_NOT_PROCESS(reason);
        } catch {
            revert COULD_NOT_PROCESS("exactInput");
        }
    }

    function _exactOutputSingle(
        uint256 value,
        ISwapRouter.ExactOutputSingleParams memory params
    ) internal returns (uint256) {
        params.deadline = block.timestamp;
        params.recipient = address(this);

        try ROUTER.exactOutputSingle{value: value}(params) returns (
            uint256 amountIn
        ) {
            return amountIn;
        } catch Error(string memory reason) {
            revert COULD_NOT_PROCESS(reason);
        } catch {
            revert COULD_NOT_PROCESS("exactOutputSingle");
        }
    }

    function _exactOutput(
        uint256 value,
        ISwapRouter.ExactOutputParams memory params
    ) internal returns (uint256) {
        params.deadline = block.timestamp;
        params.recipient = address(this);

        try ROUTER.exactOutput{value: value}(params) returns (
            uint256 amountIn
        ) {
            return amountIn;
        } catch Error(string memory reason) {
            revert COULD_NOT_PROCESS(reason);
        } catch {
            revert COULD_NOT_PROCESS("exactOutput");
        }
    }

    function _getFirstToken(bytes memory path) internal pure returns (address) {
        return path.toAddress(0);
    }

    function _getLastToken(bytes memory path) internal pure returns (address) {
        if (path.length < PATH_SIZE)
            revert COULD_NOT_PROCESS("Path size too small");
        return path.toAddress(path.length - ADDRESS_SIZE);
    }

}
