// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import {VoteProposalLib} from "../../libraries/VotingStatusLib.sol";
import { IDiamondCut } from "../../interfaces/IDiamondCut.sol";
import { LibDiamond } from "../../libraries/LibDiamond.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@gnus.ai/contracts-upgradeable-diamond/metatx/MinimalForwarderUpgradeable.sol";
import "@gnus.ai/contracts-upgradeable-diamond/metatx/ERC2771ContextUpgradeable.sol";

import "./UniswapV2Library.sol";
import "./IUniswapV2Router02.sol";
import "../handlerBase.sol";

contract UniSwapV2Facet is ERC2771ContextUpgradeable, HandlerBase {
    using SafeERC20 for IERC20;
    error COULD_NOT_PROCESS(string);
    
    address public immutable UNISWAPV2_ROUTER;
    
    constructor(MinimalForwarderUpgradeable forwarder, address _UNISWAPV2_ROUTER)
        ERC2771ContextUpgradeable(address(forwarder))
        {UNISWAPV2_ROUTER = _UNISWAPV2_ROUTER;}


 modifier checkValidity(uint256 _id) {  
            VoteProposalLib.enforceMarried();
            VoteProposalLib.enforceUserHasAccess(_msgSender());
            VoteProposalLib.enforceAcceptedStatus(_id);    
            _;
    }

    //Adding ETH as a liquidity
    function UniAddLiquidityETH(
        uint256 _id,
        uint256 amountETHMin,
        uint256 amountTokenMin
    ) external payable checkValidity(_id) {

         VoteProposalLib.VoteTracking storage vt = VoteProposalLib
            .VoteTrackingStorage();

        if (vt.voteProposalAttributes[_id].voteType != 501) {revert COULD_NOT_PROCESS('wrong type');}
         vt.voteProposalAttributes[_id].voteStatus =501;
        
         uint256 value = vt.voteProposalAttributes[_id].amount;
         uint256 amountTokenDesired = vt.voteProposalAttributes[_id].voteends;
         address token = vt.voteProposalAttributes[_id].tokenID;
         
         // Get uniswapV2 router
        IUniswapV2Router02 router = IUniswapV2Router02(UNISWAPV2_ROUTER);

             // Approve token
        value = _getBalance(address(0), value);
        amountTokenDesired = _getBalance(token, amountTokenDesired);
        _tokenApprove(token, UNISWAPV2_ROUTER, amountTokenDesired);

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
         {
        
        } catch Error(string memory reason) {
            revert COULD_NOT_PROCESS(reason);
        } catch {
            revert COULD_NOT_PROCESS("addLiquidityETH");
        }
        _tokenApproveZero(token, UNISWAPV2_ROUTER);

          emit VoteProposalLib.VoteStatus(
            _id,
            _msgSender(),
            501,
            block.timestamp
        ); 
        VoteProposalLib.checkForwarder(); 
    }


    function uniAddLiquidity(
        uint256 _id,
        uint256 amountAMin,
        uint256 amountBMin
    ) external payable checkValidity(_id){

         VoteProposalLib.VoteTracking storage vt = VoteProposalLib
            .VoteTrackingStorage();

        if (vt.voteProposalAttributes[_id].voteType != 502) {revert COULD_NOT_PROCESS('wrong type');}
         vt.voteProposalAttributes[_id].voteStatus = 502;
        
         uint256 amountADesired = vt.voteProposalAttributes[_id].amount;
         uint256 amountBDesired = vt.voteProposalAttributes[_id].voteends;
         address tokenA = vt.voteProposalAttributes[_id].tokenID;
         address tokenB = vt.voteProposalAttributes[_id].receiver;
         
         // Get uniswapV2 router
        IUniswapV2Router02 router = IUniswapV2Router02(UNISWAPV2_ROUTER);

        // Approve token
        amountADesired = _getBalance(tokenA, amountADesired);
        amountBDesired = _getBalance(tokenB, amountBDesired);
        _tokenApprove(tokenA, UNISWAPV2_ROUTER, amountADesired);
        _tokenApprove(tokenB, UNISWAPV2_ROUTER, amountBDesired);

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
        _tokenApproveZero(tokenA, UNISWAPV2_ROUTER);
        _tokenApproveZero(tokenB, UNISWAPV2_ROUTER);

          emit VoteProposalLib.VoteStatus(
            _id,
            _msgSender(),
            502,
            block.timestamp
        ); 
        VoteProposalLib.checkForwarder(); 
    }

     function uniRemoveLiquidityETH(
        uint256 _id,
        uint256 amountTokenMin,
        uint256 amountETHMin
    ) external payable checkValidity(_id) returns (
            uint256 amountToken,
            uint256 amountETH
        ){

         VoteProposalLib.VoteTracking storage vt = VoteProposalLib
            .VoteTrackingStorage();

        if (vt.voteProposalAttributes[_id].voteType != 503) {revert COULD_NOT_PROCESS('wrong type');}
         vt.voteProposalAttributes[_id].voteStatus =503;
        

        address token = vt.voteProposalAttributes[_id].tokenID;
        uint256 liquidity = vt.voteProposalAttributes[_id].amount;
         
         
         // Get uniswapV2 router
        IUniswapV2Router02 router = IUniswapV2Router02(UNISWAPV2_ROUTER);
        address pair =
            UniswapV2Library.pairFor(router.factory(), token, router.WETH());

               // Approve token
        liquidity = _getBalance(pair, liquidity);
        _tokenApprove(pair, UNISWAPV2_ROUTER, liquidity);

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
         _tokenApproveZero(pair, UNISWAPV2_ROUTER);

          emit VoteProposalLib.VoteStatus(
            _id,
            _msgSender(),
            503,
            block.timestamp
        ); 
        VoteProposalLib.checkForwarder(); 
    }

     function uniRemoveLiquidity(
        uint256 _id,
        uint256 amountAMin,
        uint256 amountBMin
    ) external payable checkValidity(_id) returns (
            uint256 amountA,
            uint256 amountB
        ){

         VoteProposalLib.VoteTracking storage vt = VoteProposalLib
            .VoteTrackingStorage();

        if (vt.voteProposalAttributes[_id].voteType != 504) {revert COULD_NOT_PROCESS('wrong type');}
         vt.voteProposalAttributes[_id].voteStatus =504;
        

        address tokenA = vt.voteProposalAttributes[_id].tokenID;
        address tokenB = vt.voteProposalAttributes[_id].receiver;
        uint256 liquidity = vt.voteProposalAttributes[_id].amount;
         
         
         // Get uniswapV2 router
        IUniswapV2Router02 router = IUniswapV2Router02(UNISWAPV2_ROUTER);
        address pair =
            UniswapV2Library.pairFor(router.factory(), tokenA, tokenB);

               // Approve token
        liquidity = _getBalance(pair, liquidity);
        _tokenApprove(pair, UNISWAPV2_ROUTER, liquidity);

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
         _tokenApproveZero(pair, UNISWAPV2_ROUTER);

          emit VoteProposalLib.VoteStatus(
            _id,
            _msgSender(),
            504,
            block.timestamp
        ); 
        VoteProposalLib.checkForwarder(); 
    }
    

    function executeUniV2Swap(
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
         IUniswapV2Router02 router = IUniswapV2Router02(UNISWAPV2_ROUTER);
         //swapExactETHForTokens
        if (vt.voteProposalAttributes[_id].voteType == 505 ) {
        vt.voteProposalAttributes[_id].voteStatus = 505;
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
        else if (vt.voteProposalAttributes[_id].voteType == 506 ) {
        vt.voteProposalAttributes[_id].voteStatus =506;
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
       else if (vt.voteProposalAttributes[_id].voteType == 507 ) {
        vt.voteProposalAttributes[_id].voteStatus =507;
        
        address tokenIn = vt.voteProposalAttributes[_id].tokenID;
        if (path[0]!= tokenIn) revert COULD_NOT_PROCESS("wrong pair");
        amount = _getBalance(tokenIn, amount);
        _tokenApprove(tokenIn, UNISWAPV2_ROUTER, amount);
        
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
        _tokenApproveZero(tokenIn, UNISWAPV2_ROUTER);
        }

         //swapTokensForExactETH
       else if (vt.voteProposalAttributes[_id].voteType == 508 ) {
        vt.voteProposalAttributes[_id].voteStatus =508;
        
        address tokenIn = vt.voteProposalAttributes[_id].tokenID;
        if (path[0]!= tokenIn) revert COULD_NOT_PROCESS("wrong pair");
        requiredAmount = _getBalance(tokenIn, requiredAmount);
        _tokenApprove(tokenIn, UNISWAPV2_ROUTER, requiredAmount);
        
       try
            router.swapTokensForExactETH(
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
             revert COULD_NOT_PROCESS("swapExactTokensForETH");
        }
        _tokenApproveZero(tokenIn, UNISWAPV2_ROUTER);
        }

        //swapExactTokensForTokens
        else if (vt.voteProposalAttributes[_id].voteType == 509 ) {
        vt.voteProposalAttributes[_id].voteStatus =509;
        address tokenIn = vt.voteProposalAttributes[_id].tokenID;
        amount = _getBalance(tokenIn, amount);
        _tokenApprove(tokenIn, UNISWAPV2_ROUTER, amount);

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
        _tokenApproveZero(tokenIn, UNISWAPV2_ROUTER);
        }

         //swapTokensForExactTokens
        else if (vt.voteProposalAttributes[_id].voteType == 510 ) {
        vt.voteProposalAttributes[_id].voteStatus =510;
        address tokenIn = vt.voteProposalAttributes[_id].tokenID;
        address tokenOut = vt.voteProposalAttributes[_id].receiver;
        requiredAmount = _getBalance(tokenIn, requiredAmount);
        _tokenApprove(tokenIn, UNISWAPV2_ROUTER, requiredAmount);

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
        _tokenApproveZero(tokenIn, UNISWAPV2_ROUTER);
        }

     
     emit VoteProposalLib.VoteStatus(
            _id,
            msgSender_,
            vt.voteProposalAttributes[_id].voteStatus,
            block.timestamp
        ); 
        VoteProposalLib.checkForwarder(); 
    }

    function getPairAddressV2(address tokenA, address tokenB) external view returns (address Pair){
         IUniswapV2Router02 router = IUniswapV2Router02(UNISWAPV2_ROUTER);
           return  UniswapV2Library.pairFor(router.factory(), tokenA, tokenB); 
    }

}

