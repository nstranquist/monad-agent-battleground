// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./AgentNFT.sol";

/// @title BattleArena
/// @notice Stake MON, challenge agents, resolve battles onchain in one transaction.
contract BattleArena {
    AgentNFT public immutable nft;

    uint256 public constant BATTLE_STAKE = 0.001 ether;
    uint256 public constant PROTOCOL_FEE_BPS = 500; // 5%

    enum BattleStatus { Pending, Completed, Cancelled }

    struct Battle {
        uint256 id;
        uint256 challengerAgentId;
        uint256 challengedAgentId;
        address challenger;
        address challenged;
        uint256 stake;
        BattleStatus status;
        uint256 winnerAgentId;
        uint256 createdAt;
        uint256 resolvedAt;
    }

    uint256 public nextBattleId = 1;
    mapping(uint256 => Battle) public battles;
    uint256[] private _allBattleIds;
    uint256 public protocolFees;
    address public owner;

    event BattleCreated(
        uint256 indexed battleId,
        uint256 indexed challengerAgentId,
        uint256 indexed challengedAgentId,
        address challenger,
        address challenged
    );
    event BattleResolved(
        uint256 indexed battleId,
        uint256 indexed winnerAgentId,
        address winner,
        uint256 payout
    );
    event BattleCancelled(uint256 indexed battleId);

    constructor(address _nft) {
        nft = AgentNFT(_nft);
        owner = msg.sender;
    }

    /// @notice Challenge another agent to a staked battle
    function challenge(uint256 myAgentId, uint256 opponentAgentId)
        external payable returns (uint256 battleId)
    {
        require(msg.value == BATTLE_STAKE, "Must stake exact amount");
        AgentNFT.Agent memory myAgent = nft.getAgent(myAgentId);
        AgentNFT.Agent memory opAgent = nft.getAgent(opponentAgentId);
        require(myAgent.owner == msg.sender, "Not your agent");
        require(opAgent.exists, "Opponent not found");
        require(myAgentId != opponentAgentId, "Cannot fight yourself");

        battleId = nextBattleId++;
        battles[battleId] = Battle({
            id: battleId,
            challengerAgentId: myAgentId,
            challengedAgentId: opponentAgentId,
            challenger: msg.sender,
            challenged: opAgent.owner,
            stake: msg.value,
            status: BattleStatus.Pending,
            winnerAgentId: 0,
            createdAt: block.timestamp,
            resolvedAt: 0
        });
        _allBattleIds.push(battleId);
        emit BattleCreated(battleId, myAgentId, opponentAgentId, msg.sender, opAgent.owner);
    }

    /// @notice Accept a pending challenge — battle resolves atomically in this tx
    function acceptChallenge(uint256 battleId) external payable {
        Battle storage battle = battles[battleId];
        require(battle.status == BattleStatus.Pending, "Not pending");
        require(msg.value == battle.stake, "Must match stake");
        AgentNFT.Agent memory myAgent = nft.getAgent(battle.challengedAgentId);
        require(myAgent.owner == msg.sender, "Not your agent");
        _resolveBattle(battleId);
    }

    /// @notice Cancel unaccepted challenge after 1 hour
    function cancelChallenge(uint256 battleId) external {
        Battle storage battle = battles[battleId];
        require(battle.status == BattleStatus.Pending, "Not pending");
        require(battle.challenger == msg.sender, "Not challenger");
        require(block.timestamp >= battle.createdAt + 1 hours, "Wait 1 hour");
        battle.status = BattleStatus.Cancelled;
        payable(battle.challenger).transfer(battle.stake);
        emit BattleCancelled(battleId);
    }

    function _resolveBattle(uint256 battleId) internal {
        Battle storage battle = battles[battleId];
        AgentNFT.Agent memory agentA = nft.getAgent(battle.challengerAgentId);
        AgentNFT.Agent memory agentB = nft.getAgent(battle.challengedAgentId);

        bytes32 seed = keccak256(abi.encodePacked(
            blockhash(block.number - 1),
            battleId,
            battle.challengerAgentId,
            battle.challengedAgentId,
            block.timestamp
        ));

        uint256 scoreA = _calcScore(agentA, uint256(seed));
        uint256 scoreB = _calcScore(agentB, uint256(seed) >> 128);

        bool challengerWins = scoreA >= scoreB;
        uint256 winnerAgentId = challengerWins ? battle.challengerAgentId : battle.challengedAgentId;
        uint256 loserAgentId  = challengerWins ? battle.challengedAgentId : battle.challengerAgentId;
        address winner        = challengerWins ? battle.challenger : battle.challenged;

        // Update NFT W/L — tokenURI SVG reflects new record immediately
        nft.recordBattleResult(winnerAgentId, loserAgentId);

        uint256 pot     = battle.stake * 2;
        uint256 fee     = (pot * PROTOCOL_FEE_BPS) / 10000;
        uint256 payout  = pot - fee;
        protocolFees   += fee;

        battle.winnerAgentId = winnerAgentId;
        battle.status        = BattleStatus.Completed;
        battle.resolvedAt    = block.timestamp;

        payable(winner).transfer(payout);
        emit BattleResolved(battleId, winnerAgentId, winner, payout);
    }

    function _calcScore(AgentNFT.Agent memory agent, uint256 seed)
        internal pure returns (uint256)
    {
        uint256 strMul = (seed % 10) + 1;
        uint256 spdMul = ((seed >> 32) % 10) + 1;
        uint256 intMul = ((seed >> 64) % 10) + 1;
        return uint256(agent.strength) * strMul
             + uint256(agent.speed)    * spdMul
             + uint256(agent.intelligence) * intMul;
    }

    function getBattle(uint256 battleId) external view returns (Battle memory) {
        return battles[battleId];
    }

    function getAllBattleIds() external view returns (uint256[] memory) {
        return _allBattleIds;
    }

    function totalBattles() external view returns (uint256) {
        return _allBattleIds.length;
    }

    function withdrawFees() external {
        require(msg.sender == owner, "Not owner");
        uint256 amount = protocolFees;
        protocolFees = 0;
        payable(owner).transfer(amount);
    }

    receive() external payable {}
}
