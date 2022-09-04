// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/******************************************************************************\
* Author: Nick Mudge <nick@perfectabstractions.com> (https://twitter.com/mudgen)
* EIP-2535 Diamonds: https://eips.ethereum.org/EIPS/eip-2535
/******************************************************************************/


library VoteProposalLib {
     bytes32 constant VT_STORAGE_POSITION = keccak256("waverimplementation.VoteTracking.Lib");

    /* Enum Statuses of Voting proposals*/
    enum Status {
        notProposed,
        Proposed,
        Accepted,
        Declined,
        Cancelled,
        Paid,
        Divorced,
        Invested,
        Redeemed,
        SwapSubmitted,
        NFTsent,
        FamilyAdded,
        FamilyDeleted
    }
    struct VoteProposal {
                uint256 id;
                address proposer;
                uint8   voteType;
                uint256 tokenVoteQuantity;
                string voteProposalText;
                Status voteStatus;
                uint256 voteStarts;
                uint256 voteends;
                address receiver;
                address tokenID;
                uint256 amount;
                 }
   
   event VoteStatus(
        uint256 indexed id,
        address sender,
        Status voteStatus,
        uint256 timestamp
    );
    
    struct VoteTracking {
        uint256 voteid; //Tracking voting proposals by VOTEID 
        uint256[] findVoteId; //List of vote IDs 
        mapping(uint256 => VoteProposal) voteProposalAttributes;//Storage of voting proposals
        mapping(uint256 => mapping(address => bool))  votingStatus; // Tracking whether address has voted for particular voteid
        mapping(uint256 => uint256) numTokenFor; //Number of tokens voted for the proposal
        mapping(uint256 => uint256) numTokenAgainst; //Number of tokens voted against the proposal
        mapping(uint256 => uint256) votersLeft; //Number of voters left to vote by voteid
    }

 function VoteTrackingStorage() internal pure returns (VoteTracking storage vt) {
        bytes32 position = VT_STORAGE_POSITION;
        assembly {
            vt.slot := position
        }
    }

  function enforceNotVoted(uint _voteid)  internal view {
          require(
            VoteTrackingStorage().votingStatus[_voteid][msg.sender] != true
        );
    } 
 function enforceProposedStatus(uint _voteid)  internal view {
          require(
          VoteTrackingStorage().voteProposalAttributes[_voteid].voteStatus == Status.Proposed
        );
    } 

  function enforceAcceptedStatus(uint _voteid)  internal view {
          require(
          VoteTrackingStorage().voteProposalAttributes[_voteid].voteStatus == Status.Accepted
        );
    } 

function enforceOnlyProposer(uint _voteid)  internal view {
          require(
          VoteTrackingStorage().voteProposalAttributes[_voteid].proposer == msg.sender
        );
    } 
function enforceDeadlinePassed(uint _voteid)  internal view {
          require(
          VoteTrackingStorage().voteProposalAttributes[_voteid].voteends + VoteTrackingStorage().voteProposalAttributes[_voteid].voteStarts < block.timestamp 
        );
    } 
  
}
