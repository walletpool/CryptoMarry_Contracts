// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {VoteProposalLib} from "../libraries/VotingStatusLib.sol";
import { IDiamondCut } from "../interfaces/IDiamondCut.sol";
import { LibDiamond } from "../libraries/LibDiamond.sol";

import "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";
import "@uniswap/v3-periphery/contracts/libraries/TransferHelper.sol";
//import "hardhat/console.sol";

/*Interface for the ISWAP Router (Uniswap)  Contract*/
interface IUniswapRouter is ISwapRouter {
    function refundETH() external payable;
}

interface WETH9Contract {
    function balanceOf(address) external returns (uint);
    function withdraw(uint amount) external;
}

contract UniSwapFacet {
    
    /* Uniswap Router Address with interface*/

     function executeETHSwap(
        uint24 _id,
        uint256 _oracleprice,
        IUniswapRouter _swapRouter,
        uint24 poolfee
    ) external {

        VoteProposalLib.enforceMarried();
        VoteProposalLib.enforceUserHasAccess();
        VoteProposalLib.enforceAcceptedStatus(_id);
        VoteProposalLib.VoteTracking storage vt = VoteProposalLib
            .VoteTrackingStorage();
    
        
        IUniswapRouter swapRouter;
        swapRouter = _swapRouter;

        require(vt.voteProposalAttributes[_id].voteType == 101);

        //A small fee for the protocol is deducted here
        uint256 _amount = (vt.voteProposalAttributes[_id].amount *
            (10000 - vt.cmFee)) / 10000;
        uint256 _cmfees = vt.voteProposalAttributes[_id].amount - _amount;

       VoteProposalLib.processtxn(vt.addressWaveContract, _cmfees);

            ISwapRouter.ExactInputSingleParams memory params = ISwapRouter
                .ExactInputSingleParams({
                    tokenIn: vt.voteProposalAttributes[_id].tokenID,
                    tokenOut: vt.voteProposalAttributes[_id].receiver,
                    fee: poolfee,
                    recipient: address(this),
                    deadline: block.timestamp+ 30 minutes,
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
        uint24 _id,
        uint256 _oracleprice,
        IUniswapRouter _swapRouter,
        uint24 poolfee
    ) external {
        
        VoteProposalLib.enforceMarried();
        VoteProposalLib.enforceUserHasAccess();
        VoteProposalLib.enforceAcceptedStatus(_id);
        VoteProposalLib.VoteTracking storage vt = VoteProposalLib
            .VoteTrackingStorage();
 
        require(vt.voteProposalAttributes[_id].voteType == 102);

         IUniswapRouter swapRouter;
        swapRouter = _swapRouter;

        //A small fee for the protocol is deducted here
        uint256 _amount = (vt.voteProposalAttributes[_id].amount *
            (10000 - vt.cmFee)) / 10000;
        uint256 _cmfees = vt.voteProposalAttributes[_id].amount - _amount;

       
                TransferHelper.safeTransfer(
                    vt.voteProposalAttributes[_id].tokenID,
                    vt.addressWaveContract,
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
                    deadline: block.timestamp+ 30 minutes,
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

      function withdrawWeth(uint amount,WETH9Contract wethAddress) external{
        
        VoteProposalLib.enforceUserHasAccess();
        WETH9Contract Weth = WETH9Contract(wethAddress);
        Weth.withdraw(amount); 
    
      } 

}