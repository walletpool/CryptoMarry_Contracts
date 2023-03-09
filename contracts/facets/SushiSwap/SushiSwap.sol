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
        uint256 amountTokenMin,
        uint256 amountETHMin
    ) external payable checkValidity(_id) returns (
            uint256 amountToken,
            uint256 amountETH,
            uint256 liquidity
        ){

         VoteProposalLib.VoteTracking storage vt = VoteProposalLib
            .VoteTrackingStorage();

        if (vt.voteProposalAttributes[_id].voteType != 526) {revert COULD_NOT_PROCESS('wrong type');}
         vt.voteProposalAttributes[_id].voteStatus =526;
        
         uint256 value = vt.voteProposalAttributes[_id].amount;
         uint256 amountTokenDesired = vt.voteProposalAttributes[_id].voteends;
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
            526,
            block.timestamp
        ); 
        VoteProposalLib.checkForwarder(); 
    }

    function sushiAddLiquidity(
        uint24 _id,
        uint256 amountAMin,
        uint256 amountBMin
    ) external payable checkValidity(_id){

         VoteProposalLib.VoteTracking storage vt = VoteProposalLib
            .VoteTrackingStorage();

        if (vt.voteProposalAttributes[_id].voteType != 527) {revert COULD_NOT_PROCESS('wrong type');}
         vt.voteProposalAttributes[_id].voteStatus =527;
        
         uint256 amountADesired = vt.voteProposalAttributes[_id].amount;
         uint256 amountBDesired = vt.voteProposalAttributes[_id].voteends;
         address tokenA = vt.voteProposalAttributes[_id].tokenID;
         address tokenB = vt.voteProposalAttributes[_id].receiver;
         
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
            527,
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

        if (vt.voteProposalAttributes[_id].voteType != 528) {revert COULD_NOT_PROCESS('wrong type');}
         vt.voteProposalAttributes[_id].voteStatus =528;
        

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
            528,
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

        if (vt.voteProposalAttributes[_id].voteType != 529) {revert COULD_NOT_PROCESS('wrong type');}
         vt.voteProposalAttributes[_id].voteStatus =529;
        

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
            529,
            block.timestamp
        ); 
        VoteProposalLib.checkForwarder(); 
    }
    

    function executeSushiSwap(
        uint24 _id,
         uint256 requiredAmount,
         address[] calldata path
    ) external payable returns (uint256 resp){
       address msgSender_ = _msgSender();   
        VoteProposalLib.enforceMarried();
        VoteProposalLib.enforceUserHasAccess(msgSender_);
        VoteProposalLib.enforceAcceptedStatus(_id);
        VoteProposalLib.VoteTracking storage vt = VoteProposalLib
            .VoteTrackingStorage();

        uint256 amount = vt.voteProposalAttributes[_id].amount;
        require (path.length>=2);
         IUniswapV2Router02 router = IUniswapV2Router02(sushiSwapRouter);
         
        //swapExactETHForTokens
        if (vt.voteProposalAttributes[_id].voteType == 520 ) {
        vt.voteProposalAttributes[_id].voteStatus =520;
        amount = _getBalance(address(0), amount);
        address tokenOut =vt.voteProposalAttributes[_id].receiver;
        if (path[path.length - 1]!= tokenOut) revert COULD_NOT_PROCESS("wrong pair");
       
        try
            router.swapExactETHForTokens{value: amount}(
                requiredAmount,
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
        //swapETHForExactTokens
        else if (vt.voteProposalAttributes[_id].voteType == 521 ) {
        vt.voteProposalAttributes[_id].voteStatus = 521;
        requiredAmount = _getBalance(address(0), requiredAmount);
       
        if (path[0]!= vt.voteProposalAttributes[_id].tokenID) revert COULD_NOT_PROCESS("wrong pair");
        try
            router.swapETHForExactTokens{value: requiredAmount}(
                amount,
                path,
                address(this),
                block.timestamp
            )
        returns (uint256[] memory amounts) {
            resp = amounts[0];
        } catch Error(string memory reason) {
            revert COULD_NOT_PROCESS(reason);
        } catch {
             revert COULD_NOT_PROCESS("swapExactETHForTokens");
        }
        }

        //swapExactTokensForETH
       else if (vt.voteProposalAttributes[_id].voteType == 522 ) {
        vt.voteProposalAttributes[_id].voteStatus =522;
        
        address tokenIn = vt.voteProposalAttributes[_id].tokenID;
        if (path[0]!= tokenIn) revert COULD_NOT_PROCESS("wrong pair");
        amount = _getBalance(tokenIn, amount);
        _tokenApprove(tokenIn, sushiSwapRouter, amount);
        
       try
            router.swapExactTokensForETH(
                amount,
                requiredAmount,
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

         //swapTokensForExactETH
       else if (vt.voteProposalAttributes[_id].voteType == 523 ) {
        vt.voteProposalAttributes[_id].voteStatus =523;
        
        address tokenIn = vt.voteProposalAttributes[_id].tokenID;
        if (path[0]!= tokenIn) revert COULD_NOT_PROCESS("wrong pair");
        requiredAmount = _getBalance(tokenIn, requiredAmount);
        _tokenApprove(tokenIn, sushiSwapRouter, requiredAmount);
       try
            router.swapTokensForExactETH(
                amount, //AmountInMax
                requiredAmount,
                path,
                address(this),
                block.timestamp
            )
        returns (uint256[] memory amounts) {
            resp = amounts[0];
        } catch Error(string memory reason) {
            revert COULD_NOT_PROCESS(reason);
        } catch {
             revert COULD_NOT_PROCESS("swapExactTokensForETH");
        }
        _tokenApproveZero(tokenIn, sushiSwapRouter);
        }


        //swapExactTokensForTokens
        else if (vt.voteProposalAttributes[_id].voteType == 524 ) {
        vt.voteProposalAttributes[_id].voteStatus =524;
        address tokenIn = vt.voteProposalAttributes[_id].tokenID;
        amount = _getBalance(tokenIn, amount);
        _tokenApprove(tokenIn, sushiSwapRouter, amount);

         if (path[0]!= tokenIn || path[path.length - 1]!= vt.voteProposalAttributes[_id].receiver) revert COULD_NOT_PROCESS("wrong pair");
       try
            router.swapExactTokensForTokens(
                amount,
                requiredAmount,
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

         //swapTokensForExactTokens
        else if (vt.voteProposalAttributes[_id].voteType == 525 ) {
        vt.voteProposalAttributes[_id].voteStatus =525;
        address tokenIn = vt.voteProposalAttributes[_id].tokenID;
        address tokenOut = vt.voteProposalAttributes[_id].receiver;
        requiredAmount = _getBalance(tokenIn, requiredAmount);
        _tokenApprove(tokenIn, sushiSwapRouter, requiredAmount);

         if (path[0]!= tokenIn || path[path.length - 1]!= tokenOut) revert COULD_NOT_PROCESS("wrong pair");
       try
            router.swapTokensForExactTokens(
                amount,
                requiredAmount,
                path,
                address(this),
                block.timestamp
            )
        returns (uint256[] memory amounts) {
            resp = amounts[0];
        } catch Error(string memory reason) {
            revert COULD_NOT_PROCESS(reason);
        } catch {
             revert COULD_NOT_PROCESS("swapTokensForExactTokens");
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

     function getPairAddressSushi(address tokenA, address tokenB) external view returns (address Pair){
         IUniswapV2Router02 router = IUniswapV2Router02(sushiSwapRouter);
           return  SushiSwapLibrary.pairFor(router.factory(), tokenA, tokenB); 
    }

}

