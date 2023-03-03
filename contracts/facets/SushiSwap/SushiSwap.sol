// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import {VoteProposalLib} from "../../libraries/VotingStatusLib.sol";
import { IDiamondCut } from "../../interfaces/IDiamondCut.sol";
import { LibDiamond } from "../../libraries/LibDiamond.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@gnus.ai/contracts-upgradeable-diamond/metatx/MinimalForwarderUpgradeable.sol";
import "@gnus.ai/contracts-upgradeable-diamond/metatx/ERC2771ContextUpgradeable.sol";
import "@uniswap/v3-periphery/contracts/libraries/TransferHelper.sol";
import "./SushiSwapLibrary.sol";
import "./IUniswapV2Router02.sol";
import "../handlerBase.sol";

contract SushiSwapFacet is ERC2771ContextUpgradeable, HandlerBase {
    using SafeERC20 for IERC20;
    error COULD_NOT_PROCESS(string);
    
    address public immutable sushiSwapRouter;
    
    constructor(MinimalForwarderUpgradeable forwarder, address _sushiSwapRouter)
        ERC2771ContextUpgradeable(address(forwarder))
        {sushiSwapRouter = _sushiSwapRouter;}


 modifier checkValidity(uint24 _id) {  
            VoteProposalLib.enforceMarried();
            VoteProposalLib.enforceUserHasAccess(_msgSender());
            VoteProposalLib.enforceAcceptedStatus(_id);    
            _;
    }


    function sushiAddLiquidityETH(
        uint24 _id,
        uint256 amountTokenDesired,
        uint256 amountTokenMin,
        uint256 amountETHMin
    ) external payable checkValidity(_id) returns (
            uint256 amountToken,
            uint256 amountETH,
            uint256 liquidity
        ){

         VoteProposalLib.VoteTracking storage vt = VoteProposalLib
            .VoteTrackingStorage();

        if (vt.voteProposalAttributes[_id].voteType != 136) {revert COULD_NOT_PROCESS('wrong type');}
         vt.voteProposalAttributes[_id].voteStatus =136;
        
         uint256 value = vt.voteProposalAttributes[_id].amount;
         address token = vt.voteProposalAttributes[_id].tokenID;
         
         // Get uniswapV2 router
        IUniswapV2Router02 router = IUniswapV2Router02(sushiSwapRouter);

             // Approve token
        value = _getBalance(address(0), value);
        amountTokenDesired = _getBalance(token, amountTokenDesired);
        _tokenApprove(token, sushiSwapRouter, amountTokenDesired);

        // Add liquidity ETH
        try
            router.addLiquidityETH{value: value}(
                token,
                amountTokenDesired,
                amountTokenMin,
                amountETHMin,
                address(this),
                block.timestamp
            )
        returns (uint256 ret1, uint256 ret2, uint256 ret3) {
            amountToken = ret1;
            amountETH = ret2;
            liquidity = ret3;
        } catch Error(string memory reason) {
            revert COULD_NOT_PROCESS(reason);
        } catch {
            revert COULD_NOT_PROCESS("addLiquidityETH");
        }
        _tokenApproveZero(token, sushiSwapRouter);

          emit VoteProposalLib.VoteStatus(
            _id,
            _msgSender(),
            136,
            block.timestamp
        ); 
        VoteProposalLib.checkForwarder(); 
    }

    function sushiAddLiquidity(
        uint24 _id,
        uint256 amountBDesired,
        uint256 amountAMin,
        uint256 amountBMin
    ) external payable checkValidity(_id){

         VoteProposalLib.VoteTracking storage vt = VoteProposalLib
            .VoteTrackingStorage();

        if (vt.voteProposalAttributes[_id].voteType != 137) {revert COULD_NOT_PROCESS('wrong type');}
         vt.voteProposalAttributes[_id].voteStatus =137;
        
         uint256 amountADesired = vt.voteProposalAttributes[_id].amount;
         address tokenA = vt.voteProposalAttributes[_id].tokenID;
         address tokenB = vt.voteProposalAttributes[_id].tokenID;
         
         // Get uniswapV2 router
        IUniswapV2Router02 router = IUniswapV2Router02(sushiSwapRouter);

        // Approve token
        amountADesired = _getBalance(tokenA, amountADesired);
        amountBDesired = _getBalance(tokenB, amountBDesired);
        _tokenApprove(tokenA, sushiSwapRouter, amountADesired);
        _tokenApprove(tokenB, sushiSwapRouter, amountBDesired);

        // Add liquidity ETH
         try
            router.addLiquidity(
                tokenA,
                tokenB,
                amountADesired,
                amountBDesired,
                amountAMin,
                amountBMin,
                address(this),
                block.timestamp
            ) {      
        } catch Error(string memory reason) {
            revert COULD_NOT_PROCESS(reason);
        } catch {
            revert COULD_NOT_PROCESS("addLiquidity");
        }
        _tokenApproveZero(tokenA, sushiSwapRouter);
        _tokenApproveZero(tokenB, sushiSwapRouter);

          emit VoteProposalLib.VoteStatus(
            _id,
            _msgSender(),
            137,
            block.timestamp
        ); 
        VoteProposalLib.checkForwarder(); 
    }

     function sushiRemoveLiquidityETH(
        uint24 _id,
        uint256 amountTokenMin,
        uint256 amountETHMin
    ) external payable checkValidity(_id) returns (
            uint256 amountToken,
            uint256 amountETH
        ){

         VoteProposalLib.VoteTracking storage vt = VoteProposalLib
            .VoteTrackingStorage();

        if (vt.voteProposalAttributes[_id].voteType != 138) {revert COULD_NOT_PROCESS('wrong type');}
         vt.voteProposalAttributes[_id].voteStatus =138;
        

        address token = vt.voteProposalAttributes[_id].tokenID;
        uint256 liquidity = vt.voteProposalAttributes[_id].amount;
         
         
         // Get uniswapV2 router
        IUniswapV2Router02 router = IUniswapV2Router02(sushiSwapRouter);
        address pair =
            SushiSwapLibrary.pairFor(router.factory(), token, router.WETH());

               // Approve token
        liquidity = _getBalance(pair, liquidity);
        _tokenApprove(pair, sushiSwapRouter, liquidity);

        // remove liquidityETH
        try
            router.removeLiquidityETH(
                token,
                liquidity,
                amountTokenMin,
                amountETHMin,
                address(this),
                block.timestamp
            )
        returns (uint256 ret1, uint256 ret2) {
            amountToken = ret1;
            amountETH = ret2;
        } catch Error(string memory reason) {
            revert COULD_NOT_PROCESS(reason);
        } catch {
            revert COULD_NOT_PROCESS("addLiquidityETH");
        }
         _tokenApproveZero(pair, sushiSwapRouter);

          emit VoteProposalLib.VoteStatus(
            _id,
            _msgSender(),
            138,
            block.timestamp
        ); 
        VoteProposalLib.checkForwarder(); 
    }

     function sushiRemoveLiquidity(
        uint24 _id,
        uint256 amountAMin,
        uint256 amountBMin
    ) external payable checkValidity(_id) returns (
            uint256 amountA,
            uint256 amountB
        ){

         VoteProposalLib.VoteTracking storage vt = VoteProposalLib
            .VoteTrackingStorage();

        if (vt.voteProposalAttributes[_id].voteType != 139) {revert COULD_NOT_PROCESS('wrong type');}
         vt.voteProposalAttributes[_id].voteStatus =139;
        

        address tokenA = vt.voteProposalAttributes[_id].tokenID;
        address tokenB = vt.voteProposalAttributes[_id].receiver;
        uint256 liquidity = vt.voteProposalAttributes[_id].amount;
         
         
         // Get uniswapV2 router
        IUniswapV2Router02 router = IUniswapV2Router02(sushiSwapRouter);
        address pair =
            SushiSwapLibrary.pairFor(router.factory(), tokenA, tokenB);

               // Approve token
        liquidity = _getBalance(pair, liquidity);
        _tokenApprove(pair, sushiSwapRouter, liquidity);

         try
            router.removeLiquidity(
                tokenA,
                tokenB,
                liquidity,
                amountAMin,
                amountBMin,
                address(this),
                block.timestamp
            )
        returns (uint256 ret1, uint256 ret2) {
            amountA = ret1;
            amountB = ret2;
        } catch Error(string memory reason) {
            revert COULD_NOT_PROCESS(reason);
        } catch {
            revert COULD_NOT_PROCESS("removeLiquidity");
        }
         _tokenApproveZero(pair, sushiSwapRouter);

          emit VoteProposalLib.VoteStatus(
            _id,
            _msgSender(),
            139,
            block.timestamp
        ); 
        VoteProposalLib.checkForwarder(); 
    }
    

    function executeSushiSwap(
        uint24 _id,
         uint256 amountOutMin,
         address[] calldata path
    ) external payable returns (uint256 resp){
       address msgSender_ = _msgSender();   
        VoteProposalLib.enforceMarried();
        VoteProposalLib.enforceUserHasAccess(msgSender_);
        VoteProposalLib.enforceAcceptedStatus(_id);
        VoteProposalLib.VoteTracking storage vt = VoteProposalLib
            .VoteTrackingStorage();

        uint256 amount = vt.voteProposalAttributes[_id].amount;
         IUniswapV2Router02 router = IUniswapV2Router02(sushiSwapRouter);

        if (vt.voteProposalAttributes[_id].voteType != 140 ) {
        vt.voteProposalAttributes[_id].voteStatus =140;
        amount = _getBalance(address(0), amount);
        if (path[path.length - 1]!= vt.voteProposalAttributes[_id].tokenID) revert COULD_NOT_PROCESS("wrong pair");
        try
            router.swapExactETHForTokens{value: amount}(
                amountOutMin,
                path,
                address(this),
                block.timestamp
            )
        returns (uint256[] memory amounts) {
            resp = amounts[amounts.length - 1];
        } catch Error(string memory reason) {
            revert COULD_NOT_PROCESS(reason);
        } catch {
             revert COULD_NOT_PROCESS("swapExactETHForTokens");
        }
        }

        if (vt.voteProposalAttributes[_id].voteType != 141 ) {
        vt.voteProposalAttributes[_id].voteStatus =141;
        address tokenIn = vt.voteProposalAttributes[_id].tokenID;
        amount = _getBalance(tokenIn, amount);
        _tokenApprove(tokenIn, sushiSwapRouter, amount);
        if (path[0]!= vt.voteProposalAttributes[_id].tokenID) revert COULD_NOT_PROCESS("wrong pair");
       try
            router.swapExactTokensForETH(
                amount,
                amountOutMin,
                path,
                address(this),
                block.timestamp
            )
        returns (uint256[] memory amounts) {
            resp = amounts[amounts.length - 1];
        } catch Error(string memory reason) {
            revert COULD_NOT_PROCESS(reason);
        } catch {
             revert COULD_NOT_PROCESS("swapExactTokensForETH");
        }
        _tokenApproveZero(tokenIn, sushiSwapRouter);
        }

        if (vt.voteProposalAttributes[_id].voteType != 142 ) {
        vt.voteProposalAttributes[_id].voteStatus =142;
        address tokenIn = vt.voteProposalAttributes[_id].tokenID;
        amount = _getBalance(tokenIn, amount);
        _tokenApprove(tokenIn, sushiSwapRouter, amount);

         if (path[0]!= vt.voteProposalAttributes[_id].tokenID || path[path.length - 1]!= vt.voteProposalAttributes[_id].receiver) revert COULD_NOT_PROCESS("wrong pair");
       try
            router.swapExactTokensForTokens(
                amount,
                amountOutMin,
                path,
                address(this),
                block.timestamp
            )
        returns (uint256[] memory amounts) {
            resp = amounts[amounts.length - 1];
        } catch Error(string memory reason) {
            revert COULD_NOT_PROCESS(reason);
        } catch {
             revert COULD_NOT_PROCESS("swapExactTokensForTokens");
        }
        _tokenApproveZero(tokenIn, sushiSwapRouter);
        }

     
     emit VoteProposalLib.VoteStatus(
            _id,
            msgSender_,
            vt.voteProposalAttributes[_id].voteStatus,
            block.timestamp
        ); 
        VoteProposalLib.checkForwarder(); 
    }

}

