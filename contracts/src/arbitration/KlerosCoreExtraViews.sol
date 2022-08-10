// SPDX-License-Identifier: MIT

/**
 *  @authors: [@unknownunknown1, @jaybuidl]
 *  @reviewers: []
 *  @auditors: []
 *  @bounties: []
 *  @deployments: []
 */

pragma solidity ^0.8;

import "./KlerosCore.sol";

/**
 *  @title KlerosCoreExtraViews
 *  @dev Extra view functions for KlerosLiquid. Not part of bug bounty.
 */
contract KlerosCoreExtraViews {
    // ************************************* //
    // *             Storage               * //
    // ************************************* //

    KlerosCore public core;

    /** @dev Constructor.
     *  @param _core The KlerosCore contract address.
     */
    constructor(KlerosCore _core) {
        core = _core;
    }

    // ************************************* //
    // *           Public Views            * //
    // ************************************* //

    function getDisputesWithoutJurors() external view returns (uint256 disputesWithoutJurors) {
        for (uint256 i = 0; i < core.getDisputeKitNodesLength(); i++) {
            (, IDisputeKit disputeKit, , ) = core.disputeKitNodes(i);
            disputesWithoutJurors += disputeKit.disputesWithoutJurors();
        }
    }

    function getDisputeKitsWithDisputeWithoutJurors() external view returns (uint256[] memory) {
        // Hack to resize a memory array, not possible with Solidity.
        uint256[] memory disputeKitsIDs = new uint256[](core.getDisputeKitNodesLength());
        uint256 usage;
        for (uint256 i = 0; i < core.getDisputeKitNodesLength(); i++) {
            (, IDisputeKit disputeKit, , ) = core.disputeKitNodes(i);
            if (i != core.NULL_DISPUTE_KIT() && disputeKit.disputesWithoutJurors() > 0) {
                disputeKitsIDs[usage++] = i;
            }
        }
        uint256 excessLength = disputeKitsIDs.length - usage;
        assembly {
            mstore(disputeKitsIDs, sub(mload(disputeKitsIDs), excessLength))
        }
        return disputeKitsIDs;
    }

    function getDisputeKitsResolving() external view returns (uint256[] memory) {
        // Hack to resize a memory array, not possible with Solidity.
        uint256[] memory disputeKitsIDs = new uint256[](core.getDisputeKitNodesLength());
        uint256 usage;
        for (uint256 i = 1; i < core.getDisputeKitNodesLength(); i++) {
            (, IDisputeKit disputeKit, , ) = core.disputeKitNodes(i);
            if (disputeKit.isResolving()) {
                disputeKitsIDs[usage++] = i;
            }
        }
        uint256 excessLength = disputeKitsIDs.length - usage;
        assembly {
            mstore(disputeKitsIDs, sub(mload(disputeKitsIDs), excessLength))
        }
        return disputeKitsIDs;
    }

    // function getDisputeKitsWithFreezingNeeded() external view returns (uint256[] memory) {
    //     // Hack to resize a memory array, not possible with Solidity.
    //     uint256[] memory disputeKitsIDs = new uint256[](disputeKitNodes.length);
    //     uint256 usage;
    //     for (uint256 i = 1; i < disputeKitNodes.length; i++) {
    //         if (disputeKitNodes[i].disputeKit.disputesWithoutJurors() > 0) {
    //             disputeKitsIDs[usage++] = i;
    //         }
    //     }
    //     uint256 excessLength = disputeKitsIDs.length - usage;
    //     assembly {
    //         mstore(disputeKitsIDs, sub(mload(disputeKitsIDs), excessLength))
    //     }
    //     return disputeKitsIDs;
    // }
}
