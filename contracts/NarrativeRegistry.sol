// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title NarrativeRegistry
/// @notice Stores AI-generated Claude battle narratives permanently on Monad.
///         The authority (server deployer wallet) writes narratives after each
///         battle resolves. Anyone can read — stored onchain forever.
contract NarrativeRegistry {
    address public authority;
    mapping(uint256 => string) private _narratives;

    event NarrativeStored(uint256 indexed battleId, string narrative);

    error NotAuthorized();
    error EmptyNarrative();

    constructor(address _authority) {
        authority = _authority;
    }

    /// @notice Store the AI-generated narrative for a resolved battle.
    /// @dev Only callable by the authority (server wallet).
    function setNarrative(uint256 battleId, string calldata narrative) external {
        if (msg.sender != authority) revert NotAuthorized();
        if (bytes(narrative).length == 0) revert EmptyNarrative();
        _narratives[battleId] = narrative;
        emit NarrativeStored(battleId, narrative);
    }

    /// @notice Read the stored narrative for a battle.
    /// @return Empty string if not yet stored.
    function getNarrative(uint256 battleId) external view returns (string memory) {
        return _narratives[battleId];
    }
}
