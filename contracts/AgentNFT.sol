// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/utils/Base64.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

/// @title AgentNFT
/// @notice Soulbound dynamic NFT — your champion lives onchain, earns its record, can never be sold.
///         tokenURI returns a fully onchain SVG card that updates with every win and loss.
contract AgentNFT is ERC721 {
    using Strings for uint256;
    using Strings for uint8;

    // -------------------------------------------------------------------------
    // Storage
    // -------------------------------------------------------------------------

    struct Agent {
        uint256 id;
        string name;
        address owner;
        uint8 strength;      // min 1, sum of str+spd+int == 10
        uint8 speed;
        uint8 intelligence;
        string personalityPrompt;
        uint256 wins;
        uint256 losses;
        uint256 createdAt;
        bool exists;
    }

    uint256 public nextTokenId = 1;
    mapping(uint256 => Agent) private _agents;
    mapping(address => uint256[]) private _ownerAgents;
    uint256[] private _allAgentIds;

    address public battleArena;

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------

    event AgentMinted(
        uint256 indexed tokenId,
        address indexed owner,
        string name,
        uint8 str,
        uint8 spd,
        uint8 intel,
        string personality
    );
    event PersonalityUpdated(uint256 indexed tokenId, string prompt);
    event RecordUpdated(uint256 indexed tokenId, uint256 wins, uint256 losses);

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------

    constructor() ERC721("Agent Battle Arena", "AGENT") {}

    // -------------------------------------------------------------------------
    // Setup
    // -------------------------------------------------------------------------

    function setBattleArena(address _battleArena) external {
        require(battleArena == address(0), "Already set");
        require(_battleArena != address(0), "Zero address");
        battleArena = _battleArena;
    }

    // -------------------------------------------------------------------------
    // Minting
    // -------------------------------------------------------------------------

    /// @notice Mint your soulbound agent champion. Stats must sum to exactly 10.
    function mint(
        string calldata name,
        uint8 strength,
        uint8 speed,
        uint8 intelligence,
        string calldata personalityPrompt
    ) external returns (uint256 tokenId) {
        require(bytes(name).length > 0 && bytes(name).length <= 32, "Name: 1-32 chars");
        require(
            uint16(strength) + uint16(speed) + uint16(intelligence) == 10,
            "Stats must sum to 10"
        );
        require(strength >= 1 && speed >= 1 && intelligence >= 1, "Min 1 per stat");
        require(bytes(personalityPrompt).length <= 200, "Personality: max 200 chars");

        tokenId = nextTokenId++;
        _agents[tokenId] = Agent({
            id: tokenId,
            name: name,
            owner: msg.sender,
            strength: strength,
            speed: speed,
            intelligence: intelligence,
            personalityPrompt: personalityPrompt,
            wins: 0,
            losses: 0,
            createdAt: block.timestamp,
            exists: true
        });

        _ownerAgents[msg.sender].push(tokenId);
        _allAgentIds.push(tokenId);

        _safeMint(msg.sender, tokenId);
        emit AgentMinted(tokenId, msg.sender, name, strength, speed, intelligence, personalityPrompt);
    }

    // -------------------------------------------------------------------------
    // Customization
    // -------------------------------------------------------------------------

    /// @notice Update your agent's personality prompt. Stored on-chain and emitted as an event.
    function updatePersonality(uint256 tokenId, string calldata prompt) external {
        require(_agents[tokenId].exists, "Agent not found");
        require(_agents[tokenId].owner == msg.sender, "Not your agent");
        require(bytes(prompt).length <= 200, "Max 200 chars");
        _agents[tokenId].personalityPrompt = prompt;
        emit PersonalityUpdated(tokenId, prompt);
    }

    // -------------------------------------------------------------------------
    // Battle hook (called by BattleArena only)
    // -------------------------------------------------------------------------

    function recordBattleResult(uint256 winnerId, uint256 loserId) external {
        require(msg.sender == battleArena, "Only BattleArena");
        require(_agents[winnerId].exists && _agents[loserId].exists, "Agent not found");
        _agents[winnerId].wins++;
        _agents[loserId].losses++;
        emit RecordUpdated(winnerId, _agents[winnerId].wins, _agents[winnerId].losses);
        emit RecordUpdated(loserId, _agents[loserId].wins, _agents[loserId].losses);
    }

    // -------------------------------------------------------------------------
    // Soulbound — override all transfer paths to revert
    // -------------------------------------------------------------------------

    /// @dev OZ v5 uses _update as the single transfer hook.
    ///      Revert if from != address(0) (i.e. any transfer, not initial mint).
    function _update(
        address to,
        uint256 tokenId,
        address auth
    ) internal override returns (address) {
        address from = _ownerOf(tokenId);
        if (from != address(0)) {
            revert("Soulbound: non-transferable");
        }
        return super._update(to, tokenId, auth);
    }

    // -------------------------------------------------------------------------
    // Dynamic onchain SVG tokenURI
    // -------------------------------------------------------------------------

    function tokenURI(uint256 tokenId)
        public
        view
        override
        returns (string memory)
    {
        require(_agents[tokenId].exists, "Agent not found");
        Agent memory a = _agents[tokenId];

        string memory agentClass = _getClass(a.strength, a.speed, a.intelligence);
        string memory svg = _buildSVG(a, agentClass);

        string memory json = Base64.encode(
            bytes(
                string.concat(
                    '{"name":"',
                    a.name,
                    ' #',
                    tokenId.toString(),
                    '","description":"Soulbound agent on Monad. Record: ',
                    a.wins.toString(),
                    'W-',
                    a.losses.toString(),
                    'L.","image":"data:image/svg+xml;base64,',
                    Base64.encode(bytes(svg)),
                    '","attributes":[',
                    '{"trait_type":"Strength","value":',
                    uint256(a.strength).toString(),
                    '},{"trait_type":"Speed","value":',
                    uint256(a.speed).toString(),
                    '},{"trait_type":"Intelligence","value":',
                    uint256(a.intelligence).toString(),
                    '},{"trait_type":"Class","value":"',
                    agentClass,
                    '"},{"trait_type":"Wins","value":',
                    a.wins.toString(),
                    '},{"trait_type":"Losses","value":',
                    a.losses.toString(),
                    '}]}'
                )
            )
        );

        return string.concat("data:application/json;base64,", json);
    }

    function _buildSVG(Agent memory a, string memory agentClass)
        internal
        pure
        returns (string memory)
    {
        // Stat bar widths (max 160px for full bar = stat 10)
        uint256 strW = uint256(a.strength) * 16;
        uint256 spdW = uint256(a.speed) * 16;
        uint256 intW = uint256(a.intelligence) * 16;

        // Win rate label
        uint256 total = a.wins + a.losses;
        string memory wrLabel = total == 0
            ? "NEW"
            : string.concat(_pct(a.wins, total), "% WR");

        return string.concat(
            // Card background
            '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="420" viewBox="0 0 300 420">',
            '<defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">',
            '<stop offset="0%" stop-color="#0D0D18"/><stop offset="100%" stop-color="#0A0A0F"/></linearGradient>',
            '<linearGradient id="str" x1="0" y1="0" x2="1" y2="0">',
            '<stop offset="0%" stop-color="#EF4444"/><stop offset="100%" stop-color="#F97316"/></linearGradient>',
            '<linearGradient id="spd" x1="0" y1="0" x2="1" y2="0">',
            '<stop offset="0%" stop-color="#EAB308"/><stop offset="100%" stop-color="#FDE047"/></linearGradient>',
            '<linearGradient id="int" x1="0" y1="0" x2="1" y2="0">',
            '<stop offset="0%" stop-color="#3B82F6"/><stop offset="100%" stop-color="#818CF8"/></linearGradient>',
            '</defs>',
            // Base card
            '<rect width="300" height="420" fill="url(#bg)" rx="14"/>',
            '<rect x="1" y="1" width="298" height="418" fill="none" stroke="#836EF9" stroke-width="1.5" rx="13" opacity="0.8"/>',
            // Purple header band
            '<rect x="0" y="0" width="300" height="72" fill="#836EF9" rx="13"/>',
            '<rect x="0" y="60" width="300" height="12" fill="#836EF9"/>',
            // Header: icon + name
            '<text x="18" y="44" font-family="monospace,Courier" font-size="22" fill="white">&#9876;</text>',
            '<text x="50" y="44" font-family="monospace,Courier" font-size="17" font-weight="bold" fill="white" letter-spacing="1">',
            _truncate(a.name, 16),
            '</text>',
            // Class + ID
            '<text x="18" y="92" font-family="monospace,Courier" font-size="11" fill="#836EF9" letter-spacing="2">',
            agentClass,
            '</text>',
            '<text x="245" y="92" font-family="monospace,Courier" font-size="10" fill="#555">#',
            a.id.toString(),
            '</text>',
            // Divider
            '<line x1="18" y1="102" x2="282" y2="102" stroke="#2A2A3A" stroke-width="1"/>',
            // STATS label
            '<text x="18" y="122" font-family="monospace,Courier" font-size="9" fill="#555" letter-spacing="3">STATS</text>',
            // STR bar
            '<text x="18" y="142" font-family="monospace,Courier" font-size="11" fill="#999">STR</text>',
            '<rect x="52" y="132" width="160" height="9" fill="#1A1A2E" rx="4"/>',
            '<rect x="52" y="132" width="', strW.toString(), '" height="9" fill="url(#str)" rx="4"/>',
            '<text x="220" y="142" font-family="monospace,Courier" font-size="11" fill="white">', uint256(a.strength).toString(), '</text>',
            // SPD bar
            '<text x="18" y="164" font-family="monospace,Courier" font-size="11" fill="#999">SPD</text>',
            '<rect x="52" y="154" width="160" height="9" fill="#1A1A2E" rx="4"/>',
            '<rect x="52" y="154" width="', spdW.toString(), '" height="9" fill="url(#spd)" rx="4"/>',
            '<text x="220" y="164" font-family="monospace,Courier" font-size="11" fill="white">', uint256(a.speed).toString(), '</text>',
            // INT bar
            '<text x="18" y="186" font-family="monospace,Courier" font-size="11" fill="#999">INT</text>',
            '<rect x="52" y="176" width="160" height="9" fill="#1A1A2E" rx="4"/>',
            '<rect x="52" y="176" width="', intW.toString(), '" height="9" fill="url(#int)" rx="4"/>',
            '<text x="220" y="186" font-family="monospace,Courier" font-size="11" fill="white">', uint256(a.intelligence).toString(), '</text>',
            // Divider
            '<line x1="18" y1="204" x2="282" y2="204" stroke="#2A2A3A" stroke-width="1"/>',
            // RECORD
            '<text x="18" y="222" font-family="monospace,Courier" font-size="9" fill="#555" letter-spacing="3">RECORD</text>',
            '<text x="18" y="252" font-family="monospace,Courier" font-size="26" font-weight="bold" fill="#22C55E">',
            a.wins.toString(), 'W</text>',
            '<text x="95" y="252" font-family="monospace,Courier" font-size="26" fill="#444">-</text>',
            '<text x="115" y="252" font-family="monospace,Courier" font-size="26" font-weight="bold" fill="#EF4444">',
            a.losses.toString(), 'L</text>',
            '<text x="230" y="252" font-family="monospace,Courier" font-size="13" fill="#836EF9">', wrLabel, '</text>',
            // Divider
            '<line x1="18" y1="268" x2="282" y2="268" stroke="#2A2A3A" stroke-width="1"/>',
            // Footer
            '<text x="18" y="288" font-family="monospace,Courier" font-size="8" fill="#444">SOULBOUND - MONAD TESTNET</text>',
            '<text x="18" y="304" font-family="monospace,Courier" font-size="8" fill="#444">AGENT BATTLE ARENA - CHAIN 10143</text>',
            // Glow effect
            '<rect x="1" y="1" width="298" height="418" fill="none" stroke="#836EF9" stroke-width="0.5" rx="13" opacity="0.3"/>',
            '</svg>'
        );
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    function _getClass(uint8 str, uint8 spd, uint8 intel)
        internal
        pure
        returns (string memory)
    {
        if (str >= 6) return "BERSERKER";
        if (spd >= 6) return "SPEEDSTER";
        if (intel >= 6) return "ORACLE";
        if (str == spd && spd == intel) return "BALANCED"; // 3-3-4 or 4-3-3 etc
        if (str >= spd && str >= intel) return "WARRIOR";
        if (spd >= str && spd >= intel) return "PHANTOM";
        return "SAGE";
    }

    /// @dev Truncate a string to maxLen characters (byte-safe for ASCII)
    function _truncate(string memory s, uint256 maxLen)
        internal
        pure
        returns (string memory)
    {
        bytes memory b = bytes(s);
        if (b.length <= maxLen) return s;
        bytes memory result = new bytes(maxLen);
        for (uint256 i = 0; i < maxLen; i++) {
            result[i] = b[i];
        }
        return string(result);
    }

    /// @dev Integer percentage: floor(a * 100 / b)
    function _pct(uint256 a, uint256 b) internal pure returns (string memory) {
        if (b == 0) return "0";
        return (a * 100 / b).toString();
    }

    // -------------------------------------------------------------------------
    // Views
    // -------------------------------------------------------------------------

    function getAgent(uint256 tokenId) external view returns (Agent memory) {
        require(_agents[tokenId].exists, "Agent not found");
        return _agents[tokenId];
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
