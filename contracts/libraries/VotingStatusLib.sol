// SPDX-License-Identifier: BSL
pragma solidity ^0.8.17;

/**
*   [BSL License]
*   @title Library of the Proxy Contract
*   @notice Proxy contracts use variables from this libriary. 
*   @dev The proxy uses Diamond Pattern for modularity. Relevant code was borrowed from  
    Nick Mudge.    
*   @author Ismailov Altynbek <altyni@gmail.com>
*/

library VoteProposalLib {
     bytes32 constant VT_STORAGE_POSITION = keccak256("waverimplementation.VoteTracking.Lib"); //Storing position of the variables

    struct VoteProposal {
                uint24 id;
                address proposer;
                uint8   voteType;
                uint256 tokenVoteQuantity;
                string voteProposalText;
                uint8 voteStatus;
                uint256 voteends;
                address receiver;
                address tokenID;
                uint256 amount;
                uint8 votersLeft;
                 }
   
   event VoteStatus(
        uint24 indexed id,
        address sender,
        uint8 voteStatus,
        uint256 timestamp
    ); 
    
    struct VoteTracking {
   
        uint8 familyMembers;
        MarriageStatus  marriageStatus;
        uint24 voteid; //Tracking voting proposals by VOTEID 
        address proposer;
        address proposed;
        address payable addressWaveContract;
        uint256 id;
        uint256 cmFee;
        uint256 marryDate;
        uint256 policyDays;
        mapping(address => bool) hasAccess; //Addresses that are alowed to use Proxy contract
        mapping(uint24 => VoteProposal) voteProposalAttributes;//Storage of voting proposals
        mapping(uint24 => mapping(address => bool))  votingStatus; // Tracking whether address has voted for particular voteid
        mapping(uint24 => uint256) numTokenFor; //Number of tokens voted for the proposal
        mapping(uint24 => uint256) numTokenAgainst; //Number of tokens voted against the proposal
    }

 function VoteTrackingStorage() internal pure returns (VoteTracking storage vt) {
        bytes32 position = VT_STORAGE_POSITION;
        assembly {
            vt.slot := position
        }
    }

  function enforceNotVoted(uint24 _voteid, address msgSender_)  internal view {
          require(
            VoteTrackingStorage().votingStatus[_voteid][msgSender_] != true
        );
    } 
 function enforceProposedStatus(uint24 _voteid)  internal view {
          require(
          VoteTrackingStorage().voteProposalAttributes[_voteid].voteStatus == 1
        );
    } 

  function enforceAcceptedStatus(uint24 _voteid)  internal view {
          require(
          VoteTrackingStorage().voteProposalAttributes[_voteid].voteStatus == 2 || 
          VoteTrackingStorage().voteProposalAttributes[_voteid].voteStatus == 7
        );
    } 

function enforceOnlyProposer(uint24 _voteid, address msgSender_)  internal view {
          require(
          VoteTrackingStorage().voteProposalAttributes[_voteid].proposer == msgSender_
        );
    } 
function enforceDeadlinePassed(uint24 _voteid)  internal view {
          require(
          VoteTrackingStorage().voteProposalAttributes[_voteid].voteends < block.timestamp 
        );
    } 

      /* Enum Statuses of the Marriage*/
    enum MarriageStatus {
        Proposed,
        Declined,
        Cancelled,
        Married,
        Divorced
    }

      /* Listening to whether ETH has been received/sent from the contract*/
    event AddStake(
        address indexed from,
        address indexed to,
        uint256 timestamp,
        uint256 amount
    ); 


    function enforceUserHasAccess(address msgSender_) internal view {
        require (VoteTrackingStorage().hasAccess[msgSender_] == true);
    } 

    function enforceOnlyPartners(address msgSender_) internal view {
        require(
                VoteTrackingStorage().proposed == msgSender_ || VoteTrackingStorage().proposer == msgSender_
            );
    }

    function enforceNotPartnerAddr(address _member) internal view {
        require(
                VoteTrackingStorage().proposed != _member || VoteTrackingStorage().proposer == _member
            );
    }

    function enforceNotYetMarried() internal view {
          require(
            VoteTrackingStorage().marriageStatus == MarriageStatus.Proposed ||
                VoteTrackingStorage().marriageStatus == MarriageStatus.Declined
        );

    } 

       function enforceMarried() internal view {
          require(
            VoteTrackingStorage().marriageStatus == MarriageStatus.Married
        );
    } 

    function enforceNotDivorced() internal view {
          require(
            VoteTrackingStorage().marriageStatus != MarriageStatus.Divorced
        );
    } 

    function enforceDivorced() internal view {
          require(
            VoteTrackingStorage().marriageStatus == MarriageStatus.Divorced);}
       

    
    function enforceContractHasAccess() internal view {
        require (msg.sender == VoteTrackingStorage().addressWaveContract);
    } 

        /**
     * @notice Internal function to process payments.
     * @dev call method is used to keep process gas limit higher than 2300. Amount of 0 will be skipped,
     * @param _to Address that will be reveiving payment
     * @param _amount the amount of payment
     */

    function processtxn(address payable _to, uint256 _amount) internal {
        if (_amount > 0) {
            (bool success, ) = _to.call{value: _amount}("");
            require(success);
           emit AddStake(address(this), _to, block.timestamp, _amount);
        }
    }
     
}
