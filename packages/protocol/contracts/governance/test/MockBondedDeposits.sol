pragma solidity ^0.5.8;

import "../interfaces/IBondedDeposits.sol";


 /**
 * @title A mock BondedDeposits for testing.
 */
contract MockBondedDeposits is IBondedDeposits {
  mapping(address => mapping(uint256 => uint256)) public bonded;
  mapping(address => uint256) public weights;
  mapping(address => bool) public frozen;
  // Maps a delegating address to an account.
  mapping(address => address) public delegations;
  // Maps an account address to their voting delegate.
  mapping(address => address) public voters;
  // Maps an account address to their validating delegate.
  mapping(address => address) public validators;
  // Maps an account address to their rewards delegate.
  mapping(address => address) public rewarders;

  function initialize(address, uint256) external {}
  function setCumulativeRewardWeight(uint256) external {}
  function setMaxNoticePeriod(uint256) external {}
  function redeemRewards() external returns (uint256) {}
  function freezeVoting() external {}
  function unfreezeVoting() external {}
  function deposit(uint256) external payable returns (uint256) {}
  function notify(uint256, uint256) external returns (uint256) {}
  function rebond(uint256, uint256) external returns (uint256) {}
  function withdraw(uint256) external returns (uint256) {}
  function increaseNoticePeriod(uint256, uint256, uint256) external returns (uint256) {}
  function getRewardsLastRedeemed(address) external view returns (uint96) {}
  function getNoticePeriods(address) external view returns (uint256[] memory) {}
  function getAvailabilityTimes(address) external view returns (uint256[] memory) {}
  function delegateRole(DelegateRole, address, uint8, bytes32, bytes32) external {}

  function isVotingFrozen(address account) external view returns (bool) {
    return frozen[account];
  }

  function setWeight(address account, uint256 weight) external {
    weights[account] = weight;
  }

  function setBondedDeposit(address account, uint256 noticePeriod, uint256 value) external {
    bonded[account][noticePeriod] = value;
  }

  function setVotingFrozen(address account) external {
    frozen[account] = true;
  }

  function delegateVoting(address account, address delegate) external {
    delegations[delegate] = account;
    voters[account] = delegate;
  }

  function delegateValidating(address account, address delegate) external {
    delegations[delegate] = account;
    validators[account] = delegate;
  }

  function getAccountWeight(address account) external view returns (uint256) {
    return weights[account];
  }

  function getAccountFromDelegateAndRole(address delegate, DelegateRole)
    external view returns (address)
  {
    address a = delegations[delegate];
    if (a != address(0)) {
      return a;
    } else {
      return delegate;
    }
  }

  function getDelegateFromAccountAndRole(address account, DelegateRole role)
    external view returns (address)
  {
    address a;
    if (role == DelegateRole.Validating) {
      a = validators[account];
    } else if (role == DelegateRole.Voting) {
      a = voters[account];
    } else if (role == DelegateRole.Rewards) {
      a = rewarders[account];
    }
    if (a != address(0)) {
      return a;
    } else {
      return account;
    }
  }

  function getBondedDeposit(
    address account,
    uint256 noticePeriod
  )
    external
    view
    returns (uint256, uint256)
  {
    // Always return 0 for the index.
    return (bonded[account][noticePeriod], 0);
  }
}
