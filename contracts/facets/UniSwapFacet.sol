// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {MarriageStatusLib} from "../libraries/MarriageStatusLib.sol";
import {VoteProposalLib} from "../libraries/VotingStatusLib.sol";
import { IDiamondCut } from "../interfaces/IDiamondCut.sol";
import { LibDiamond } from "../libraries/LibDiamond.sol";

import "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";
import "@uniswap/v3-periphery/contracts/libraries/TransferHelper.sol";

/*Interface for the ISWAP Router (Uniswap)  Contract*/
interface IUniswapRouter is ISwapRouter {
    function refundETH() external payable;
}

contract UniSwapFacet {
    
    /* Uniswap Router Address with interface*/

     function executeETHSwap(
        uint256 _id,
        uint256 _oracleprice,
        IUniswapRouter _swapRouter,
        uint24 poolfee
    ) external {

        MarriageStatusLib.enforceMarried();
        MarriageStatusLib.enforceUserHasAccess();
        VoteProposalLib.enforceAcceptedStatus(_id);
        VoteProposalLib.VoteTracking storage vt = VoteProposalLib
            .VoteTrackingStorage();
        MarriageStatusLib.MarriageProps storage ms = MarriageStatusLib
            .marriageStatusStorage();
        
        IUniswapRouter swapRouter;
        swapRouter = _swapRouter;

        require(vt.voteProposalAttributes[_id].voteType == 101);

        //A small fee for the protocol is deducted here
        uint256 _amount = (vt.voteProposalAttributes[_id].amount *
            (10000 - ms.cmFee)) / 10000;
        uint256 _cmfees = vt.voteProposalAttributes[_id].amount - _amount;

       MarriageStatusLib.processtxn(ms.addressWaveContract, _cmfees);

            ISwapRouter.ExactInputSingleParams memory params = ISwapRouter
                .ExactInputSingleParams({
                    tokenIn: vt.voteProposalAttributes[_id].tokenID,
                    tokenOut: vt.voteProposalAttributes[_id].receiver,
                    fee: poolfee,
                    recipient: address(this),
                    deadline: vt.voteProposalAttributes[_id].voteStarts + 30 days,
                    amountIn: _amount,
                    amountOutMinimum: _oracleprice,
                    sqrtPriceLimitX96: 0
                });

            swapRouter.exactInputSingle{value: _amount}(params);

            swapRouter.refundETH();

            vt.voteProposalAttributes[_id].voteStatus = VoteProposalLib.Status.SwapSubmitted;
        emit VoteProposalLib.VoteStatus(
            _id,
            msg.sender,
            vt.voteProposalAttributes[_id].voteStatus,
            block.timestamp
        );

    }

    function executeERCSwap(
        uint256 _id,
        uint256 _oracleprice,
        IUniswapRouter _swapRouter,
        uint24 poolfee
    ) external {
        
        MarriageStatusLib.enforceMarried();
        MarriageStatusLib.enforceUserHasAccess();
        VoteProposalLib.enforceAcceptedStatus(_id);
        VoteProposalLib.VoteTracking storage vt = VoteProposalLib
            .VoteTrackingStorage();
        MarriageStatusLib.MarriageProps storage ms = MarriageStatusLib
            .marriageStatusStorage();

        require(vt.voteProposalAttributes[_id].voteType == 102);

         IUniswapRouter swapRouter;
        swapRouter = _swapRouter;

        //A small fee for the protocol is deducted here
        uint256 _amount = (vt.voteProposalAttributes[_id].amount *
            (10000 - ms.cmFee)) / 10000;
        uint256 _cmfees = vt.voteProposalAttributes[_id].amount - _amount;

       
                TransferHelper.safeTransfer(
                    vt.voteProposalAttributes[_id].tokenID,
                    ms.addressWaveContract,
                    _cmfees
                );
            
            
            TransferHelper.safeApprove(
                vt.voteProposalAttributes[_id].tokenID,
                address(_swapRouter),
                _amount
            );
       
       ISwapRouter.ExactInputSingleParams memory params = ISwapRouter
                .ExactInputSingleParams({
                    tokenIn: vt.voteProposalAttributes[_id].tokenID,
                    tokenOut: vt.voteProposalAttributes[_id].receiver,
                    fee: poolfee,
                    recipient: address(this),
                    deadline: vt.voteProposalAttributes[_id].voteStarts + 30 days,
                    amountIn: _amount,
                    amountOutMinimum: _oracleprice,
                    sqrtPriceLimitX96: 0
                });

            swapRouter.exactInputSingle(params);

            swapRouter.refundETH();

            vt.voteProposalAttributes[_id].voteStatus = VoteProposalLib.Status.SwapSubmitted;
        emit VoteProposalLib.VoteStatus(
            _id,
            msg.sender,
            vt.voteProposalAttributes[_id].voteStatus,
            block.timestamp
        );

    }


}