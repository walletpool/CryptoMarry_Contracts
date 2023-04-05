// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import {VoteProposalLib} from "../libraries/VotingStatusLib.sol";
import { IDiamondCut } from "../interfaces/IDiamondCut.sol";
import { LibDiamond } from "../libraries/LibDiamond.sol";
import "@gnus.ai/contracts-upgradeable-diamond/metatx/MinimalForwarderUpgradeable.sol";
import "@gnus.ai/contracts-upgradeable-diamond/metatx/ERC2771ContextUpgradeable.sol";
import "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";
import "@uniswap/v3-periphery/contracts/libraries/TransferHelper.sol";
/*Interface for the ISWAP Router (Uniswap)  Contract*/
interface IUniswapRouter is ISwapRouter {
    function refundETH() external payable;
}

interface WETH9Contract {
    function balanceOf(address) external returns (uint);
    function withdraw(uint amount) external;
    function deposit() external payable;
}
contract UniSwapFacet is ERC2771ContextUpgradeable{
    IUniswapRouter immutable _swapRouter;
    WETH9Contract immutable wethAddress;

constructor (IUniswapRouter swapRouter, WETH9Contract _wethAddress,MinimalForwarderUpgradeable forwarder)
ERC2771ContextUpgradeable(address(forwarder)) 
{
    _swapRouter = swapRouter;
    wethAddress = _wethAddress;
}
 error COULD_NOT_PROCESS();
    /* Uniswap Router Address with interface*/
     function executeSwap(
        uint256 _id,
        uint256 _oracleprice,
        uint24 poolfee
    ) external {
        address msgSender_ = _msgSender();
        VoteProposalLib.enforceMarried();
        VoteProposalLib.enforceUserHasAccess(msgSender_);
        VoteProposalLib.enforceAcceptedStatus(_id);
        VoteProposalLib.VoteTracking storage vt = VoteProposalLib
            .VoteTrackingStorage();
    
        IUniswapRouter swapRouter;
        swapRouter = _swapRouter;

        //A small fee for the protocol is deducted here
        uint256 _amount = vt.voteProposalAttributes[_id].amount;

        if (vt.voteProposalAttributes[_id].voteType == 101){
            vt.voteProposalAttributes[_id].voteStatus = 101;

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
           
           uint resp = swapRouter.exactInputSingle{value: _amount}(params);
           if (resp < _oracleprice) {revert COULD_NOT_PROCESS();} 
            swapRouter.refundETH();
    emit VoteProposalLib.AddStake(address(this), address(swapRouter), block.timestamp, _amount); 
            
            } else if (vt.voteProposalAttributes[_id].voteType == 102) {
                 vt.voteProposalAttributes[_id].voteStatus = 102;
                     
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

            uint resp = swapRouter.exactInputSingle(params);
            if (resp < _oracleprice) {revert COULD_NOT_PROCESS();} 
           
                
            } else if (vt.voteProposalAttributes[_id].voteType == 103) {
                 vt.voteProposalAttributes[_id].voteStatus = 103;  
            
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

            uint resp = swapRouter.exactInputSingle(params);
            
            if (resp < _oracleprice) {revert COULD_NOT_PROCESS();} 
           
            WETH9Contract Weth = WETH9Contract(vt.voteProposalAttributes[_id].receiver);
            
            Weth.withdraw(_oracleprice); 
             
            } else {revert COULD_NOT_PROCESS();}
        

       emit VoteProposalLib.VoteStatus(
            _id,
            msgSender_,
            vt.voteProposalAttributes[_id].voteStatus,
            block.timestamp
        ); 
         VoteProposalLib.checkForwarder();
    }

    function withdrawWeth(uint amount) external{
        address msgSender_ = _msgSender();
        VoteProposalLib.enforceMarried();
        VoteProposalLib.enforceUserHasAccess(msgSender_);
        WETH9Contract Weth = WETH9Contract(wethAddress);
        Weth.withdraw(amount);
        VoteProposalLib.checkForwarder();
      } 

    function depositETH(uint amount) external payable{
        address msgSender_ = _msgSender();
        VoteProposalLib.enforceMarried();
        VoteProposalLib.enforceUserHasAccess(msgSender_);
        WETH9Contract Weth = WETH9Contract(wethAddress);
        Weth.deposit{value: amount}(); 
     
     emit VoteProposalLib.AddStake(address(this), address(wethAddress), block.timestamp, amount); 
     VoteProposalLib.checkForwarder();
    
      } 


}