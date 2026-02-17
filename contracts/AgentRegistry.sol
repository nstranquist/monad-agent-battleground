// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title AgentRegistry
/// @notice Register AI battle agents with onchain stats
contract AgentRegistry {
    struct Agent {
        uint256 id;
        string name;
        address owner;
        uint8 strength;     // min 1
        uint8 speed;        // min 1
        uint8 intelligence; // min 1
        // strength + speed + intelligence == 10
        uint256 wins;
        uint256 losses;
        uint256 createdAt;
        bool exists;
    }

    uint256 public nextAgentId = 1;
    mapping(uint256 => Agent) public agents;
    mapping(address => uint256[]) private _ownerAgents;
    uint256[] private _allAgentIds;

    address public battleArena;

    event AgentCreated(uint256 indexed agentId, address indexed owner, string name, uint8 str, uint8 spd, uint8 intel);
    event StatsUpdated(uint256 indexed agentId, uint256 wins, uint256 losses);

    modifier onlyBattleArena() {
        require(msg.sender == battleArena, "Only BattleArena");
        _;
    }

    /// @notice Called once after BattleArena is deployed
    function setBattleArena(address _battleArena) external {
        require(battleArena == address(0), "Already set");
        require(_battleArena != address(0), "Zero address");
        battleArena = _battleArena;
    }

    /// @notice Create a new agent. Stats must sum to exactly 10, each >= 1.
    function createAgent(
        string calldata name,
        uint8 strength,
        uint8 speed,
        uint8 intelligence
    ) external returns (uint256 agentId) {
        require(bytes(name).length > 0 && bytes(name).length <= 32, "Name 1-32 chars");
        require(
            uint16(strength) + uint16(speed) + uint16(intelligence) == 10,
            "Stats must sum to 10"
        );
        require(strength >= 1 && speed >= 1 && intelligence >= 1, "Min 1 per stat");

        agentId = nextAgentId++;
        agents[agentId] = Agent({
            id: agentId,
            name: name,
            owner: msg.sender,
            strength: strength,
            speed: speed,
            intelligence: intelligence,
            wins: 0,
            losses: 0,
            createdAt: block.timestamp,
            exists: true
        });

        _ownerAgents[msg.sender].push(agentId);
        _allAgentIds.push(agentId);

        emit AgentCreated(agentId, msg.sender, name, strength, speed, intelligence);
    }

    /// @notice Called by BattleArena to record battle outcomes
    function recordBattleResult(uint256 winnerId, uint256 loserId) external onlyBattleArena {
        require(agents[winnerId].exists && agents[loserId].exists, "Agent not found");
        agents[winnerId].wins++;
        agents[loserId].losses++;
        emit StatsUpdated(winnerId, agents[winnerId].wins, agents[winnerId].losses);
        emit StatsUpdated(loserId, agents[loserId].wins, agents[loserId].losses);
    }

    // --- Views ---

    function getAgent(uint256 agentId) external view returns (Agent memory) {
        require(agents[agentId].exists, "Agent not found");
        return agents[agentId];
    }

    function getOwnerAgents(address owner) external view returns (uint256[] memory) {
        return _ownerAgents[owner];
    }

    function getAllAgentIds() external view returns (uint256[] memory) {
        return _allAgentIds;
    }

    function totalAgents() external view returns (uint256) {
        return _allAgentIds.length;
    }
}
