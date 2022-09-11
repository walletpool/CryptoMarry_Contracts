// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;


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
                uint24 id;
                address proposer;
                uint8   voteType;
                uint256 tokenVoteQuantity;
                string voteProposalText;
                Status voteStatus;
                uint256 voteends;
                address receiver;
                address tokenID;
                uint256 amount;
                uint8 votersLeft;
                 }
   
   event VoteStatus(
        uint24 indexed id,
        address sender,
        Status voteStatus,
        uint256 timestamp
    );
    
    struct VoteTracking {
        mapping(address => bool) hasAccess; //Addresses that are alowed to use Proxy contract
        uint8 familyMembers;
        uint24 voteid; //Tracking voting proposals by VOTEID 
        mapping(uint24 => VoteProposal) voteProposalAttributes;//Storage of voting proposals
        mapping(uint24 => mapping(address => bool))  votingStatus; // Tracking whether address has voted for particular voteid
        mapping(uint24 => uint256) numTokenFor; //Number of tokens voted for the proposal
        mapping(uint24 => uint256) numTokenAgainst; //Number of tokens voted against the proposal
        uint256 id;
        address proposer;
        address proposed;
        address payable addressWaveContract;
        MarriageStatus  marriageStatus;
        uint256 cmFee;
        uint256 marryDate;
        uint256 policyDays;
       mapping(address => mapping(uint256 => uint8)) wasDistributed;
    }

 function VoteTrackingStorage() internal pure returns (VoteTracking storage vt) {
        bytes32 position = VT_STORAGE_POSITION;
        assembly {
            vt.slot := position
        }
    }

  function enforceNotVoted(uint24 _voteid)  internal view {
          require(
            VoteTrackingStorage().votingStatus[_voteid][msg.sender] != true
        );
    } 
 function enforceProposedStatus(uint24 _voteid)  internal view {
          require(
          VoteTrackingStorage().voteProposalAttributes[_voteid].voteStatus == Status.Proposed
        );
    } 

  function enforceAcceptedStatus(uint24 _voteid)  internal view {
          require(
          VoteTrackingStorage().voteProposalAttributes[_voteid].voteStatus == Status.Accepted
        );
    } 

function enforceOnlyProposer(uint24 _voteid)  internal view {
          require(
          VoteTrackingStorage().voteProposalAttributes[_voteid].proposer == msg.sender
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



    function enforceUserHasAccess() internal view {
        require (VoteTrackingStorage().hasAccess[msg.sender] == true);
    } 

    function enforceOnlyPartners() internal view {
        require(
                VoteTrackingStorage().proposed == msg.sender || VoteTrackingStorage().proposer == msg.sender
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
