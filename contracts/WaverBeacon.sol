// SPDX-License-Identifier: MIT

pragma solidity ^0.8.10;
/// [MIT License]
/// @title OZ Beacon contract 
/// @notice This contract to assign implementation contracts 
/// @author Ismailov Altynbek <altyni@gmail.com>

import "@openzeppelin/contracts/proxy/beacon/UpgradeableBeacon.sol";
import "@openzeppelin/contracts/access/Ownable.sol";


contract WaverBeacon is Ownable {

  UpgradeableBeacon immutable beacon;
  address public waverImplementation;


constructor(address _initWaverImplementation){
  beacon = new UpgradeableBeacon(_initWaverImplementation);
  waverImplementation=_initWaverImplementation;
  transferOwnership(tx.origin);
}


function update(address _newWaverImplementation) onlyOwner public {
  beacon.upgradeTo(_newWaverImplementation);
  waverImplementation=_newWaverImplementation;
} //Done

function implementation() public view returns (address){
  return beacon.implementation();//impAddress;
}

}