// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

library MarriageStatusLib {

    bytes32 constant MP_STORAGE_POSITION = keccak256("waverimplementation.MarriageStatus.Lib");

     /* Marriage Props*/
    struct MarriageProps {
        uint256 id;
        address proposer;
        address proposed;
        uint256 cmFee;
        uint256 familyMembers;
        uint256 marryDate;
        address payable addressWaveContract;
        MarriageStatus  marriageStatus;
        mapping(address => bool) hasAccess; //Addresses that are alowed to use Proxy contract
        mapping(address => mapping(uint256 => uint8)) wasDistributed; //Tracking whether NFT has been distributed between partners upon divorce

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


    function marriageStatusStorage() internal pure returns (MarriageProps storage mp) {
        bytes32 position = MP_STORAGE_POSITION;
        assembly {
            mp.slot := position
        }
    }

    function enforceUserHasAccess() internal view {
        require (marriageStatusStorage().hasAccess[msg.sender] == true, "revert");
    } 

    function enforceOnlyPartners() internal view {
        require(
                marriageStatusStorage().proposed == msg.sender || marriageStatusStorage().proposer == msg.sender
            );
    }

    function enforceNotPartnerAddr(address _member) internal view {
        require(
                marriageStatusStorage().proposed != _member || marriageStatusStorage().proposer == _member
            );
    }

    function enforceNotYetMarried() internal view {
          require(
            marriageStatusStorage().marriageStatus == MarriageStatus.Proposed ||
                marriageStatusStorage().marriageStatus == MarriageStatus.Declined
        );

    } 

       function enforceMarried() internal view {
          require(
            marriageStatusStorage().marriageStatus == MarriageStatus.Married
        );
    } 

    function enforceNotDivorced() internal view {
          require(
            marriageStatusStorage().marriageStatus != MarriageStatus.Divorced
        );
    } 

    function enforceDivorced() internal view {
          require(
            marriageStatusStorage().marriageStatus == MarriageStatus.Divorced);}
       

    
    function enforceContractHasAccess() internal view {
        require (msg.sender == marriageStatusStorage().addressWaveContract);
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

    function enforceHasContractCode(address _contract, string memory _errorMessage) internal view {
        uint256 contractSize;
        assembly {
            contractSize := extcodesize(_contract)
        }
        require(contractSize > 0, _errorMessage);
    }





}