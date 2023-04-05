// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import {VoteProposalLib} from "../../libraries/VotingStatusLib.sol";
import {IDiamondCut} from "../../interfaces/IDiamondCut.sol";
import {LibDiamond} from "../../libraries/LibDiamond.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@gnus.ai/contracts-upgradeable-diamond/metatx/MinimalForwarderUpgradeable.sol";
import "@gnus.ai/contracts-upgradeable-diamond/metatx/ERC2771ContextUpgradeable.sol";
import "../handlerBase.sol";
import {IStargateRouter, IStargateWidget} from "./IStargateRouter.sol";
import {IStargateRouterETH} from "./IStargateRouterETH.sol";
import {IStargateToken} from "./IStargateToken.sol";
import {IFactory, IPoolStargate} from "./IFactory.sol";

contract StargateFacet is ERC2771ContextUpgradeable, HandlerBase {
    using SafeERC20 for IERC20;
    error COULD_NOT_PROCESS(string);

    address public immutable routerStargate;
    address public immutable routerETHStargate;
    address public immutable stgTokenStargate;
    address public immutable factoryStargate;
    address public immutable widgetSwapStargate;
    bytes2 public immutable partnerIdStargate;

    constructor(
        MinimalForwarderUpgradeable forwarder,
        address router_,
        address routerETH_,
        address stgToken_,
        address factory_,
        address widgetSwap_,
        bytes2 partnerId_
    ) ERC2771ContextUpgradeable(address(forwarder)) {
       routerStargate = router_;
       routerETHStargate = routerETH_;
       stgTokenStargate = stgToken_;
       factoryStargate = factory_;
       widgetSwapStargate = widgetSwap_;
       partnerIdStargate = partnerId_;
    }

    function swapEthStargate(
        uint256 _id,
        uint256 fee,
        uint256 amountOutMin
    ) external payable {
        address msgSender_ = _msgSender();
        VoteProposalLib.enforceMarried();
        VoteProposalLib.enforceUserHasAccess(msgSender_);
        VoteProposalLib.enforceAcceptedStatus(_id);
        VoteProposalLib.VoteTracking storage vt = VoteProposalLib
            .VoteTrackingStorage();

        if (vt.voteProposalAttributes[_id].voteType != 1001) revert COULD_NOT_PROCESS("Wrong Stargate Type");
            vt.voteProposalAttributes[_id].voteStatus =1001;

        uint256 amountIn = vt.voteProposalAttributes[_id].amount;
        uint256 value =  vt.voteProposalAttributes[_id].amount + fee;
        address to = vt.voteProposalAttributes[_id].receiver;
        uint16 dstChainId = uint16(vt.voteProposalAttributes[_id].voteends);     
             // Swap ETH
        try
            IStargateRouterETH(routerETHStargate).swapETH{value: value}(
                dstChainId,
                payable(address(this)),
                abi.encodePacked(to),
                amountIn,
                amountOutMin
            )
        {} catch Error(string memory reason) {
            revert COULD_NOT_PROCESS(reason);
        } catch {
            revert COULD_NOT_PROCESS("Swap ETH");
        }
      // Partnership
        IStargateWidget(widgetSwapStargate).partnerSwap(partnerIdStargate);
        emit VoteProposalLib.VoteStatus(
            _id,
            msgSender_,
            1001,
            block.timestamp
        );
        VoteProposalLib.checkForwarder();

    }

    function swapTokenStargate(
        uint256 _id,
        uint256 fee,
        uint256 srcPoolId,
        uint256 dstPoolId,
        uint256 amountOutMin
    ) external {
        address msgSender_ = _msgSender();
        VoteProposalLib.enforceMarried();
        VoteProposalLib.enforceUserHasAccess(msgSender_);
        VoteProposalLib.enforceAcceptedStatus(_id);
        VoteProposalLib.VoteTracking storage vt = VoteProposalLib
            .VoteTrackingStorage();

        if (vt.voteProposalAttributes[_id].voteType != 1002) revert COULD_NOT_PROCESS("Wrong Stargate Type");
            vt.voteProposalAttributes[_id].voteStatus =1002;

        uint256 amountIn = vt.voteProposalAttributes[_id].amount;
        address to = vt.voteProposalAttributes[_id].receiver;
        uint16 dstChainId = uint16(vt.voteProposalAttributes[_id].voteends); 

         // Approve input token to Stargate
            IPoolStargate pool = IFactory(factoryStargate).getPool(srcPoolId);
            require(address(pool) != address(0));
            address tokenIn = pool.token();
            require (tokenIn == vt.voteProposalAttributes[_id].tokenID);
            amountIn = _getBalance(tokenIn, amountIn);
            _tokenApprove(tokenIn, routerStargate, amountIn);

             // Swap input token
        try
            IStargateRouter(routerStargate).swap{value: fee}(
                dstChainId,
                srcPoolId,
                dstPoolId,
                payable(address(this)),
                amountIn,
                amountOutMin,
                IStargateRouter.lzTxObj(0, 0, "0x"), // no destination gas
                abi.encodePacked(to),
                bytes("") // no data
            )
        {} catch Error(string memory reason) {
            revert COULD_NOT_PROCESS(reason);
        } catch {
            revert COULD_NOT_PROCESS("Swap Token");
        }
        // Reset Approval
        _tokenApproveZero(tokenIn, routerStargate);          
          // Partnership
        IStargateWidget(widgetSwapStargate).partnerSwap(partnerIdStargate);
        emit VoteProposalLib.VoteStatus(
            _id,
            msgSender_,
            1002,
            block.timestamp
        );
        VoteProposalLib.checkForwarder();
    }


    function sendTokenStargate(
        uint256 _id,
        uint256 dstGas,
        uint256 fee
    ) external {
        address msgSender_ = _msgSender();
        VoteProposalLib.enforceMarried();
        VoteProposalLib.enforceUserHasAccess(msgSender_);
        VoteProposalLib.enforceAcceptedStatus(_id);
        VoteProposalLib.VoteTracking storage vt = VoteProposalLib
            .VoteTrackingStorage();
       if (vt.voteProposalAttributes[_id].voteType != 1003) revert COULD_NOT_PROCESS("Not Stargate Type");
        
        vt.voteProposalAttributes[_id].voteStatus =1003;
        uint256 amountIn = vt.voteProposalAttributes[_id].amount;
        address to = vt.voteProposalAttributes[_id].receiver;
        uint16 dstChainId = uint16(vt.voteProposalAttributes[_id].voteends);
        amountIn = _getBalance(stgTokenStargate, amountIn);
            
            // Send STG token
        try
            IStargateToken(stgTokenStargate).sendTokens{value: fee}(
                dstChainId,
                abi.encodePacked(to),
                amountIn,
                address(0),
                abi.encodePacked(uint16(1) /* version */, dstGas)
            )
        {} catch Error(string memory reason) {
           revert COULD_NOT_PROCESS(reason);
        } catch {
            revert COULD_NOT_PROCESS("Send STG");
        }
         // Partnership
        IStargateWidget(widgetSwapStargate).partnerSwap(partnerIdStargate);
        emit VoteProposalLib.VoteStatus(
            _id,
            msgSender_,
            1003,
            block.timestamp
        );
        VoteProposalLib.checkForwarder();
    }
}