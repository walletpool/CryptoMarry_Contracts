// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import {VoteProposalLib} from "../../libraries/VotingStatusLib.sol";
import {IDiamondCut} from "../../interfaces/IDiamondCut.sol";
import {LibDiamond} from "../../libraries/LibDiamond.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "@gnus.ai/contracts-upgradeable-diamond/metatx/MinimalForwarderUpgradeable.sol";
import "@gnus.ai/contracts-upgradeable-diamond/metatx/ERC2771ContextUpgradeable.sol";
import "../handlerBase.sol";
import "./ILido.sol";

contract LidoFacet is ERC2771ContextUpgradeable, HandlerBase {
    using SafeERC20 for IERC20;
    error COULD_NOT_PROCESS(string);
    address public immutable referralLido;
    ILido public immutable lidoProxy;

    constructor(
        MinimalForwarderUpgradeable forwarder,
        address _referralLido,
        address _lidoProxy
    ) ERC2771ContextUpgradeable(address(forwarder)) {
        referralLido = _referralLido;
         lidoProxy = ILido(_lidoProxy);
    }

    function executeSubmitLido(
        uint24 _id
    ) external payable returns (uint256 stTokenAmount) {
        address msgSender_ = _msgSender();
        VoteProposalLib.enforceMarried();
        VoteProposalLib.enforceUserHasAccess(msgSender_);
        VoteProposalLib.enforceAcceptedStatus(_id);
        VoteProposalLib.VoteTracking storage vt = VoteProposalLib
            .VoteTrackingStorage();

        if (vt.voteProposalAttributes[_id].voteType != 899) revert COULD_NOT_PROCESS("Not Uniswap Type");
        uint256 amountIn = vt.voteProposalAttributes[_id].amount;
          // if amount == type(uint256).max return balance of Proxy
        amountIn = _getBalance(NATIVE_TOKEN_ADDRESS, amountIn);

         try lidoProxy.submit{value: amountIn}(referralLido) returns (
            uint256 sharesAmount
        ) {
            stTokenAmount = lidoProxy.getPooledEthByShares(sharesAmount);
        } catch Error(string memory reason) {
           revert COULD_NOT_PROCESS(reason);
        } catch {
            revert COULD_NOT_PROCESS("Submit Lido");
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