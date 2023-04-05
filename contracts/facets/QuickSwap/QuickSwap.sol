// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import {VoteProposalLib} from "../../libraries/VotingStatusLib.sol";
import { IDiamondCut } from "../../interfaces/IDiamondCut.sol";
import { LibDiamond } from "../../libraries/LibDiamond.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@gnus.ai/contracts-upgradeable-diamond/metatx/MinimalForwarderUpgradeable.sol";
import "@gnus.ai/contracts-upgradeable-diamond/metatx/ERC2771ContextUpgradeable.sol";

import "../UniswapV2/UniswapV2Library.sol";
import "../UniswapV2/IUniswapV2Router02.sol";
import "../handlerBase.sol";

contract QuickSwapV2Facet is ERC2771ContextUpgradeable, HandlerBase {
    using SafeERC20 for IERC20;
    error COULD_NOT_PROCESS(string);
    
    address public immutable QUICKSWAPV2_ROUTER;
    
    constructor(MinimalForwarderUpgradeable forwarder, address _QUICKSWAPV2_ROUTER)
        ERC2771ContextUpgradeable(address(forwarder))
        {QUICKSWAPV2_ROUTER = _QUICKSWAPV2_ROUTER;}


 modifier checkValidity(uint256 _id) {  
            VoteProposalLib.enforceMarried();
            VoteProposalLib.enforceUserHasAccess(_msgSender());
            VoteProposalLib.enforceAcceptedStatus(_id);    
            _;
    }


    function quickAddLiquidityETH(
        uint256 _id,
        uint256 amountTokenMin,
        uint256 amountETHMin
    ) external payable checkValidity(_id) returns (
            uint256 amountToken,
            uint256 amountETH,
            uint256 liquidity
        ){

         VoteProposalLib.VoteTracking storage vt = VoteProposalLib
            .VoteTrackingStorage();

        if (vt.voteProposalAttributes[_id].voteType != 550) {revert COULD_NOT_PROCESS('wrong type');}
         vt.voteProposalAttributes[_id].voteStatus =550;
        
         uint256 value = vt.voteProposalAttributes[_id].amount;
         uint256 amountTokenDesired = vt.voteProposalAttributes[_id].voteends;
         address token = vt.voteProposalAttributes[_id].tokenID;
         
         // Get uniswapV2 router
        IUniswapV2Router02 router = IUniswapV2Router02(QUICKSWAPV2_ROUTER);

             // Approve token
        value = _getBalance(address(0), value);
        amountTokenDesired = _getBalance(token, amountTokenDesired);
        _tokenApprove(token, QUICKSWAPV2_ROUTER, amountTokenDesired);

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
        _tokenApproveZero(token, QUICKSWAPV2_ROUTER);

          emit VoteProposalLib.VoteStatus(
            _id,
            _msgSender(),
            550,
            block.timestamp
        ); 
        VoteProposalLib.checkForwarder(); 
    }

    function quickAddLiquidity(
        uint256 _id,
        uint256 amountAMin,
        uint256 amountBMin
    ) external payable checkValidity(_id){

         VoteProposalLib.VoteTracking storage vt = VoteProposalLib
            .VoteTrackingStorage();

        if (vt.voteProposalAttributes[_id].voteType != 551) {revert COULD_NOT_PROCESS('wrong type');}
         vt.voteProposalAttributes[_id].voteStatus = 551;
        
         uint256 amountADesired = vt.voteProposalAttributes[_id].amount;
         uint256 amountBDesired = vt.voteProposalAttributes[_id].voteends;
         address tokenA = vt.voteProposalAttributes[_id].tokenID;
         address tokenB = vt.voteProposalAttributes[_id].receiver;
         
         // Get uniswapV2 router
        IUniswapV2Router02 router = IUniswapV2Router02(QUICKSWAPV2_ROUTER);

        // Approve token
        amountADesired = _getBalance(tokenA, amountADesired);
        amountBDesired = _getBalance(tokenB, amountBDesired);
        _tokenApprove(tokenA, QUICKSWAPV2_ROUTER, amountADesired);
        _tokenApprove(tokenB, QUICKSWAPV2_ROUTER, amountBDesired);

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
        _tokenApproveZero(tokenA, QUICKSWAPV2_ROUTER);
        _tokenApproveZero(tokenB, QUICKSWAPV2_ROUTER);

          emit VoteProposalLib.VoteStatus(
            _id,
            _msgSender(),
            551,
            block.timestamp
        ); 
        VoteProposalLib.checkForwarder(); 
    }

     function quickRemoveLiquidityETH(
        uint256 _id,
        uint256 amountTokenMin,
        uint256 amountETHMin
    ) external payable checkValidity(_id) returns (
            uint256 amountToken,
            uint256 amountETH
        ){

         VoteProposalLib.VoteTracking storage vt = VoteProposalLib
            .VoteTrackingStorage();

        if (vt.voteProposalAttributes[_id].voteType != 552) {revert COULD_NOT_PROCESS('wrong type');}
         vt.voteProposalAttributes[_id].voteStatus =552;
        
        address token = vt.voteProposalAttributes[_id].tokenID;
        uint256 liquidity = vt.voteProposalAttributes[_id].amount;
         
         
         // Get uniswapV2 router
        IUniswapV2Router02 router = IUniswapV2Router02(QUICKSWAPV2_ROUTER);
        address pair =
            UniswapV2Library.pairFor(router.factory(), token, router.WETH());

               // Approve token
        liquidity = _getBalance(pair, liquidity);
        _tokenApprove(pair, QUICKSWAPV2_ROUTER, liquidity);

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
         _tokenApproveZero(pair, QUICKSWAPV2_ROUTER);

          emit VoteProposalLib.VoteStatus(
            _id,
            _msgSender(),
            552,
            block.timestamp
        ); 
        VoteProposalLib.checkForwarder(); 
    }

     function quickRemoveLiquidity(
        uint256 _id,
        uint256 amountAMin,
        uint256 amountBMin
    ) external payable checkValidity(_id) returns (
            uint256 amountA,
            uint256 amountB
        ){

         VoteProposalLib.VoteTracking storage vt = VoteProposalLib
            .VoteTrackingStorage();

        if (vt.voteProposalAttributes[_id].voteType != 553) {revert COULD_NOT_PROCESS('wrong type');}
         vt.voteProposalAttributes[_id].voteStatus =553;
        

        address tokenA = vt.voteProposalAttributes[_id].tokenID;
        address tokenB = vt.voteProposalAttributes[_id].receiver;
        uint256 liquidity = vt.voteProposalAttributes[_id].amount;
         
         
         // Get uniswapV2 router
        IUniswapV2Router02 router = IUniswapV2Router02(QUICKSWAPV2_ROUTER);
        address pair =
            UniswapV2Library.pairFor(router.factory(), tokenA, tokenB);

               // Approve token
        liquidity = _getBalance(pair, liquidity);
        _tokenApprove(pair, QUICKSWAPV2_ROUTER, liquidity);

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
         _tokenApproveZero(pair, QUICKSWAPV2_ROUTER);

          emit VoteProposalLib.VoteStatus(
            _id,
            _msgSender(),
            553,
            block.timestamp
        ); 
        VoteProposalLib.checkForwarder(); 
    }
    

    function executeQuickSwap(
        uint256 _id,
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
         IUniswapV2Router02 router = IUniswapV2Router02(QUICKSWAPV2_ROUTER);
         //swapExactETHForTokens
        if (vt.voteProposalAttributes[_id].voteType == 554 ) {
        vt.voteProposalAttributes[_id].voteStatus =554;
        amount = _getBalance(address(0), amount);
        if (path[path.length - 1]!= vt.voteProposalAttributes[_id].receiver) revert COULD_NOT_PROCESS("wrong pair");
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
        else if (vt.voteProposalAttributes[_id].voteType == 555 ) {
        vt.voteProposalAttributes[_id].voteStatus =555;
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
             revert COULD_NOT_PROCESS("swapETHForExactTokens");
        }
        }

        //swapExactTokensForETH
       else if (vt.voteProposalAttributes[_id].voteType == 556 ) {
        vt.voteProposalAttributes[_id].voteStatus =556;
        
        address tokenIn = vt.voteProposalAttributes[_id].tokenID;
        if (path[0]!= tokenIn) revert COULD_NOT_PROCESS("wrong pair");
        amount = _getBalance(tokenIn, amount);
        _tokenApprove(tokenIn, QUICKSWAPV2_ROUTER, amount);
        
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
        _tokenApproveZero(tokenIn, QUICKSWAPV2_ROUTER);
        }

         //swapTokensForExactETH
       else if (vt.voteProposalAttributes[_id].voteType == 557 ) {
        vt.voteProposalAttributes[_id].voteStatus =557;
        
        address tokenIn = vt.voteProposalAttributes[_id].tokenID;
        if (path[0]!= tokenIn) revert COULD_NOT_PROCESS("wrong pair");
        amount = _getBalance(tokenIn, amount);
        _tokenApprove(tokenIn, QUICKSWAPV2_ROUTER, amount);
        
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
             revert COULD_NOT_PROCESS("swapTokensForExactETH");
        }
        _tokenApproveZero(tokenIn, QUICKSWAPV2_ROUTER);
        }


        //swapExactTokensForTokens
        else if (vt.voteProposalAttributes[_id].voteType == 558 ) {
        vt.voteProposalAttributes[_id].voteStatus =558;
        address tokenIn = vt.voteProposalAttributes[_id].tokenID;
        amount = _getBalance(tokenIn, amount);
        _tokenApprove(tokenIn, QUICKSWAPV2_ROUTER, amount);

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
        _tokenApproveZero(tokenIn, QUICKSWAPV2_ROUTER);
        }

         //swapTokensForExactTokens
        else if (vt.voteProposalAttributes[_id].voteType == 559 ) {
        vt.voteProposalAttributes[_id].voteStatus =559;
        address tokenIn = vt.voteProposalAttributes[_id].tokenID;
        address tokenOut = vt.voteProposalAttributes[_id].receiver;
        amount = _getBalance(tokenIn, amount);
        _tokenApprove(tokenIn, QUICKSWAPV2_ROUTER, amount);

         if (path[0]!= tokenIn || path[path.length - 1]!= tokenOut) revert COULD_NOT_PROCESS("wrong pair");
       try
            router.swapTokensForExactTokens(
                requiredAmount,
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
             revert COULD_NOT_PROCESS("swapTokensForExactTokens");
        }
        _tokenApproveZero(tokenIn, QUICKSWAPV2_ROUTER);
        }

     
     emit VoteProposalLib.VoteStatus(
            _id,
            msgSender_,
            vt.voteProposalAttributes[_id].voteStatus,
            block.timestamp
        ); 
        VoteProposalLib.checkForwarder(); 
    }

    function getPairAddressQuickSwap(address tokenA, address tokenB) external view returns (address Pair){
         IUniswapV2Router02 router = IUniswapV2Router02(QUICKSWAPV2_ROUTER);
           return  UniswapV2Library.pairFor(router.factory(), tokenA, tokenB); 
    }

}

