// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import {VoteProposalLib} from "../../libraries/VotingStatusLib.sol";
import {IDiamondCut} from "../../interfaces/IDiamondCut.sol";
import {LibDiamond} from "../../libraries/LibDiamond.sol";
import "@gnus.ai/contracts-upgradeable-diamond/metatx/MinimalForwarderUpgradeable.sol";
import "@gnus.ai/contracts-upgradeable-diamond/metatx/ERC2771ContextUpgradeable.sol";
import "./ICEther.sol";
import "./ICtoken.sol";
import "./IComptroller.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../handlerBase.sol";

contract CompoundV2Facet is ERC2771ContextUpgradeable, HandlerBase {
    using SafeERC20 for IERC20;
    error COULD_NOT_PROCESS(string);

    address public immutable COMPTROLLER;
    address public immutable PRICEFEED;

    constructor(
        MinimalForwarderUpgradeable forwarder,
        address _COMPTROLLER,
        address _PRICEFEED
    ) ERC2771ContextUpgradeable(address(forwarder)) {
        COMPTROLLER = _COMPTROLLER;
        PRICEFEED = _PRICEFEED;
    }

    function compoundV2Supply(uint24 _id) external {
        address msgSender_ = _msgSender();
        VoteProposalLib.enforceMarried();
        VoteProposalLib.enforceUserHasAccess(msgSender_);
        VoteProposalLib.enforceAcceptedStatus(_id);
        VoteProposalLib.VoteTracking storage vt = VoteProposalLib
            .VoteTrackingStorage();

        uint256 _amount = vt.voteProposalAttributes[_id].amount;
        //Supplying Ether
        if (vt.voteProposalAttributes[_id].voteType == 810) {
            vt.voteProposalAttributes[_id].voteStatus = 810;
            ICEther cToken = ICEther(vt.voteProposalAttributes[_id].receiver);

            // Get cether balance of proxy before mint
            uint256 beforeCEtherAmount = cToken.balanceOf(address(this));

            // if amount == type(uint256).max return balance of Proxy
            _amount = _getBalance(address(0), _amount);

            // Execute mint
            try cToken.mint{value: _amount}() {} catch Error(
                string memory reason
            ) {
                revert COULD_NOT_PROCESS(reason);
            } catch {
                revert COULD_NOT_PROCESS("mintCether");
            }

            // Get cether balance of proxy after mint
            uint256 afterCEtherAmount = cToken.balanceOf(address(this));

            if (afterCEtherAmount == beforeCEtherAmount)
                revert COULD_NOT_PROCESS("NoMint");

            emit VoteProposalLib.AddStake(
                address(this),
                vt.voteProposalAttributes[_id].receiver,
                block.timestamp,
                _amount
            );
        }
        //Supplying Token
        else if (vt.voteProposalAttributes[_id].voteType == 811) {
            vt.voteProposalAttributes[_id].voteStatus = 811;
            address token = vt.voteProposalAttributes[_id].tokenID;
            ICToken cToken = ICToken(vt.voteProposalAttributes[_id].receiver);
            uint256 beforeCTokenAmount = cToken.balanceOf(address(this));
            // if amount == type(uint256).max return balance of Proxy
            _amount = _getBalance(token, _amount);
            _tokenApprove(token, address(cToken), _amount);

            try cToken.mint(_amount) returns (uint256 errorCode) {
                if (errorCode == 0)
                    revert COULD_NOT_PROCESS(
                        string(
                            abi.encodePacked("error ", _uint2String(errorCode))
                        )
                    );
            } catch Error(string memory reason) {
                revert COULD_NOT_PROCESS(reason);
            } catch {
                revert COULD_NOT_PROCESS("mintCtoken");
            }
            _tokenApproveZero(token, address(cToken));

            // Get ctoken balance of proxy after mint
            uint256 afterCTokenAmount = cToken.balanceOf(address(this));
            if (afterCTokenAmount == beforeCTokenAmount)
                revert COULD_NOT_PROCESS("NoMint");
        }
        //Redeem Ether
        else if (vt.voteProposalAttributes[_id].voteType == 812) {
            vt.voteProposalAttributes[_id].voteStatus = 812;
            // Get ether balance of proxy before redeem
            uint256 beforeRedeemAmount = address(this).balance;

            ICEther cEther = ICEther(vt.voteProposalAttributes[_id].tokenID);
            // if amount == type(uint256).max return balance of Proxy
            _amount = _getBalance(address(cEther), _amount);

            // Execute redeem
            try cEther.redeem(_amount) returns (uint256 errorCode) {
                if (errorCode == 0)
                    revert COULD_NOT_PROCESS(
                        string(
                            abi.encodePacked("error ", _uint2String(errorCode))
                        )
                    );
            } catch Error(string memory reason) {
                revert COULD_NOT_PROCESS(reason);
            } catch {
                revert COULD_NOT_PROCESS("redeemETh");
            }
            // Get ether balance of proxy after redeem
            uint256 afterRedeemAmount = address(this).balance;
            if (afterRedeemAmount == beforeRedeemAmount)
                revert COULD_NOT_PROCESS("NoRedeemed");
        }
        //Redeem EtherUnderlying
        else if (vt.voteProposalAttributes[_id].voteType == 813) {
            vt.voteProposalAttributes[_id].voteStatus = 813;

            ICEther cEther = ICEther(vt.voteProposalAttributes[_id].tokenID);
            uint256 beforeCEtherAmount = cEther.balanceOf(address(this));

            try cEther.redeemUnderlying(_amount) returns (uint256 errorCode) {
                if (errorCode == 0)
                    revert COULD_NOT_PROCESS(
                        string(
                            abi.encodePacked("error ", _uint2String(errorCode))
                        )
                    );
            } catch Error(string memory reason) {
                revert COULD_NOT_PROCESS(reason);
            } catch {
                revert COULD_NOT_PROCESS("redeemEThU");
            }

            // Get cether balance of proxy after redeemUnderlying
            uint256 afterCEtherAmount = cEther.balanceOf(address(this));
            if (afterCEtherAmount == beforeCEtherAmount)
                revert COULD_NOT_PROCESS("NoRedeemedU");
        }
        // Redeeming underlying cToken for corresponding ERC20 token.
        else if (vt.voteProposalAttributes[_id].voteType == 814) {
            vt.voteProposalAttributes[_id].voteStatus = 814;

            address token = vt.voteProposalAttributes[_id].receiver;
            uint256 beforeTokenAmount = IERC20(token).balanceOf(address(this));

            ICToken compound = ICToken(vt.voteProposalAttributes[_id].tokenID);
            // if amount == type(uint256).max return balance of Proxy
            _amount = _getBalance(address(compound), _amount);

            try compound.redeem(_amount) returns (uint256 errorCode) {
                if (errorCode == 0)
                    revert COULD_NOT_PROCESS(
                        string(
                            abi.encodePacked("error ", _uint2String(errorCode))
                        )
                    );
            } catch Error(string memory reason) {
                revert COULD_NOT_PROCESS(reason);
            } catch {
                revert COULD_NOT_PROCESS("redeemEThU");
            }

            // Get token balance of proxy after redeem
            uint256 afterTokenAmount = IERC20(token).balanceOf(address(this));
            if (afterTokenAmount == beforeTokenAmount)
                revert COULD_NOT_PROCESS("NoRedeemedU");
        } else if (vt.voteProposalAttributes[_id].voteType == 815) {
            vt.voteProposalAttributes[_id].voteStatus = 815;

            ICToken compound = ICToken(vt.voteProposalAttributes[_id].tokenID);
            uint256 beforeCTokenAmount = compound.balanceOf(address(this));

            try compound.redeemUnderlying(_amount) returns (uint256 errorCode) {
                if (errorCode == 0)
                    revert COULD_NOT_PROCESS(
                        string(
                            abi.encodePacked("error ", _uint2String(errorCode))
                        )
                    );
            } catch Error(string memory reason) {
                revert COULD_NOT_PROCESS(reason);
            } catch {
                revert COULD_NOT_PROCESS("redeemUnderlying");
            }

            // Get ctoken balance of proxy after redeem
            uint256 afterCTokenAmount = compound.balanceOf(address(this));
            if (afterCTokenAmount == beforeCTokenAmount)
                revert COULD_NOT_PROCESS("NoRedeemedU");
        } else {
            revert COULD_NOT_PROCESS("NotType");
        }
        emit VoteProposalLib.VoteStatus(
            _id,
            msgSender_,
            vt.voteProposalAttributes[_id].voteStatus,
            block.timestamp
        );
        VoteProposalLib.checkForwarder();
    }

    function compoundV2BorrowRepay(uint24 _id) external {
        address msgSender_ = _msgSender();
        VoteProposalLib.enforceMarried();
        VoteProposalLib.enforceUserHasAccess(msgSender_);
        VoteProposalLib.enforceAcceptedStatus(_id);
        VoteProposalLib.VoteTracking storage vt = VoteProposalLib
            .VoteTrackingStorage();

        uint256 _amount = vt.voteProposalAttributes[_id].amount;
        //Borrowing ERC20
        if (vt.voteProposalAttributes[_id].voteType == 816) {
            vt.voteProposalAttributes[_id].voteStatus = 816;
            IComptroller comptroller = IComptroller(COMPTROLLER);
            address collateralCToken = vt.voteProposalAttributes[_id].tokenID;
            ICToken cToken = ICToken(collateralCToken);
            address token = vt.voteProposalAttributes[_id].receiver;
            uint256 beforeTokenAmount = IERC20(token).balanceOf(address(this));

            //Entering Borrow Market
            address[] memory cTokens = new address[](1);
            cTokens[0] = collateralCToken;
            uint256[] memory errors = comptroller.enterMarkets(cTokens);
            if (errors[0] != 0) {
                revert COULD_NOT_PROCESS("EnterMarkets");
            }

            // Get my account's total liquidity value in Compound
            (uint256 error, uint256 liquidity, uint256 shortfall) = comptroller
                .getAccountLiquidity(address(this));
            if (error != 0) {
                revert COULD_NOT_PROCESS("getLiquidity");
            }
            if (shortfall != 0) revert COULD_NOT_PROCESS("underWater");
            if (liquidity == 0) revert COULD_NOT_PROCESS("excessCollateral");

            // Borrow, check the underlying balance for this contract's address

            try cToken.borrow(_amount) returns (uint256 errorCode) {
                if (errorCode == 0)
                    revert COULD_NOT_PROCESS(
                        string(
                            abi.encodePacked("error ", _uint2String(errorCode))
                        )
                    );
            } catch Error(string memory reason) {
                revert COULD_NOT_PROCESS(reason);
            } catch {
                revert COULD_NOT_PROCESS("repayBorrowERC");
            }
            // Get token balance of proxy after redeem
            uint256 afterTokenAmount = IERC20(token).balanceOf(address(this));
            if (afterTokenAmount == beforeTokenAmount)
                revert COULD_NOT_PROCESS("NotBorrowed");
        }
        //Borrowing ETH
        else if (vt.voteProposalAttributes[_id].voteType == 817) {
            vt.voteProposalAttributes[_id].voteStatus = 817;
            IComptroller comptroller = IComptroller(COMPTROLLER);
            address collateralCToken = vt.voteProposalAttributes[_id].tokenID;
            ICEther cEther = ICEther(collateralCToken);

            uint256 beforeETHAmount = address(this).balance;

            //Entering Borrow Market
            address[] memory cTokens = new address[](1);
            cTokens[0] = collateralCToken;
            uint256[] memory errors = comptroller.enterMarkets(cTokens);
            if (errors[0] != 0) {
                revert COULD_NOT_PROCESS("EnterMarkets");
            }

            // Get my account's total liquidity value in Compound
            (uint256 error, uint256 liquidity, uint256 shortfall) = comptroller
                .getAccountLiquidity(address(this));
            if (error != 0) {
                revert COULD_NOT_PROCESS("getLiquidity");
            }
            if (shortfall != 0) revert COULD_NOT_PROCESS("underWater");
            if (liquidity == 0) revert COULD_NOT_PROCESS("excessCollateral");

            // Borrow, check the underlying balance for this contract's address

            try cEther.borrow(_amount) returns (uint256 errorCode) {
                if (errorCode == 0)
                    revert COULD_NOT_PROCESS(
                        string(
                            abi.encodePacked("error ", _uint2String(errorCode))
                        )
                    );
            } catch Error(string memory reason) {
                revert COULD_NOT_PROCESS(reason);
            } catch {
                revert COULD_NOT_PROCESS("repayBorrowERC");
            }

            // Get token balance of proxy after redeem
            uint256 afterEthAmount = address(this).balance;
            if (afterEthAmount == beforeETHAmount)
                revert COULD_NOT_PROCESS("NotBorrowedEth");
        }
        //Repaying ERC
        else if (vt.voteProposalAttributes[_id].voteType == 818) {
            vt.voteProposalAttributes[_id].voteStatus = 818;
            ICToken compound = ICToken(vt.voteProposalAttributes[_id].tokenID);
            address token = vt.voteProposalAttributes[_id].receiver;

            uint256 debt = compound.borrowBalanceCurrent(address(this));

            if (_amount < debt) {
                debt = _amount;
            }

            _tokenApprove(token, address(compound), debt);
            try compound.repayBorrow(debt) returns (uint256 errorCode) {
                if (errorCode == 0)
                    revert COULD_NOT_PROCESS(
                        string(
                            abi.encodePacked("error ", _uint2String(errorCode))
                        )
                    );
            } catch Error(string memory reason) {
                revert COULD_NOT_PROCESS(reason);
            } catch {
                revert COULD_NOT_PROCESS("repayBorrowERC");
            }
            _tokenApproveZero(token, address(compound));
            uint256 debtEnd = compound.borrowBalanceCurrent(address(this));

            if (debtEnd == debt) revert COULD_NOT_PROCESS("repayError");
        }
        //Repaying ETH
        else if (vt.voteProposalAttributes[_id].voteType == 819) {
            vt.voteProposalAttributes[_id].voteStatus = 819;
            ICEther compound = ICEther(vt.voteProposalAttributes[_id].tokenID);
            address token = vt.voteProposalAttributes[_id].receiver;

            uint256 debt = compound.borrowBalanceCurrent(address(this));

            if (_amount < debt) {
                debt = _amount;
            }

            try compound.repayBorrow{value: debt}() {} catch Error(
                string memory reason
            ) {
                revert COULD_NOT_PROCESS(reason);
            } catch {
                revert COULD_NOT_PROCESS("repayBorrowERC");
            }
            _tokenApproveZero(token, address(compound));
            uint256 debtEnd = compound.borrowBalanceCurrent(address(this));

            if (debtEnd == debt) revert COULD_NOT_PROCESS("repayError");
        } else {
            revert COULD_NOT_PROCESS("NotType");
        }
        emit VoteProposalLib.VoteStatus(
            _id,
            msgSender_,
            vt.voteProposalAttributes[_id].voteStatus,
            block.timestamp
        );
        VoteProposalLib.checkForwarder();
    }

    function claimComp() external payable returns (uint256) {
        IComptroller comptroller = IComptroller(COMPTROLLER);
        address comp = comptroller.getCompAddress();
        address sender = address(this);
        uint256 beforeCompBalance = IERC20(comp).balanceOf(sender);
        try comptroller.claimComp(sender) {} catch Error(string memory reason) {
            revert COULD_NOT_PROCESS(reason);
        } catch {
            revert COULD_NOT_PROCESS("claimComp");
        }
        uint256 afterCompBalance = IERC20(comp).balanceOf(sender);

        return afterCompBalance - beforeCompBalance;
    }
}
