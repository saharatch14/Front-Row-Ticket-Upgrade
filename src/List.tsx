import ListItem from './ListItem.tsx';
import './List.css';
import { useState } from 'react';
import dataQueue from './DataQueue.json';


function List() {

  type TicketQueueEntry = {  id: string;  fanId: string;  fanName: string;  ticketValue: string | number | null;  
    joinedQueueAt: string;  
    eventStartsAt: string; 
    status: "waiting" | "upgraded" | "cancelled";  
    loyaltyPoints?: number | null;  
    upgradesLast30Days?: number | null;  
    membership?: "regular" | "vip" | "blocked";  
    phoneNumber?: string | null;  
    deviceId?: string | null;  
    paymentAccount?: string | null; };

  type FrontRowUpgradeResult = {  winner: RankedEntry | null;  fanGroups: FanGroup[];  excludedEntries: ExcludedEntry[]; }; 
  type RankedEntry = {  entry: TicketQueueEntry;  score: number;  reasons: string[]; }; 
  type FanGroup = {  id: string;  entries: TicketQueueEntry[];  representative: RankedEntry | null;  connectionReasons: string[]; }; 
  type ExcludedEntry = {  entry: TicketQueueEntry;  reason: string; };

  type IdentifierType = "phone" | "device" | "payment";

  type Identifier = {
    key: string;
    reason: string;
  };

  // Scoring configuration
  const scoring = {
    maxLoyaltyPoints: 1000,
    maxWaitingHours: 24,
    fairnessStartHours: 2,
    maxUpgrades: 3,

    loyalty: 25,
    waitingTime: 30,
    vip: 15,
    ticketValue: 15,
    upgradeHistory: 10,
    fairness: 5,
  } as const;

  const [word, setWord] = useState("")
  const [list, setList] = useState<string[]>([])

  const obj = JSON.parse(JSON.stringify(dataQueue)) as TicketQueueEntry[];

  function validateEntry(
    entry: TicketQueueEntry,
    now: Date
  ): string | null {

    if (entry.status === "cancelled") {
      return "Entry is cancelled";
    }

    if (entry.status === "upgraded") {
      return "Entry was already upgraded";
    }

    const eventStart = new Date(entry.eventStartsAt);

    if (
      !Number.isFinite(eventStart.getTime())
    ) {
      return "Invalid event start time";
    }

    if (now.getTime() >= eventStart.getTime()) {
      return "Concert has already started";
    }

    if (entry.membership === "blocked") {
      return "Fan is blocked";
    }

    const ticketValue = Number(entry.ticketValue);

    if (
      entry.ticketValue === null ||
      typeof entry.ticketValue === "string" &&
        !entry.ticketValue.trim() ||
      !Number.isFinite(ticketValue) ||
      ticketValue <= 0
    ) {
      return "Invalid ticket value";
    }

    const joinedAt = new Date(entry.joinedQueueAt);

    if (
      !Number.isFinite(joinedAt.getTime()) ||
      joinedAt.getTime() > now.getTime()
    ) {
      return "Invalid queue join time";
    }

    return null;
  }

  function filterEligibleEntries(
    entries: TicketQueueEntry[],
    now: Date
  ): {
    eligibleEntries: TicketQueueEntry[];
    excludedEntries: ExcludedEntry[];
  } {

    const eligibleEntries: TicketQueueEntry[] = [];
    const excludedEntries: ExcludedEntry[] = [];

    for (const entry of entries) {

      const reason = validateEntry(entry, now);

      if (reason !== null) {
        excludedEntries.push({
          entry,
          reason,
        });
        continue;
      }

      eligibleEntries.push(entry);
    }

    return {
      eligibleEntries,
      excludedEntries,
    };
  }

  function normalizeIdentifier(
    value: string | null | undefined,
    type: IdentifierType
  ): string | null {

    if (value == null || !value.trim()) {
      return null;
    }

    const trimmed = value.trim();

    switch (type) {
      case "phone":
        return trimmed.replace(/\D/g, "") || null;

      case "device":
      case "payment":
        return trimmed.toLowerCase();
    }
  }

  function getIdentifiers(
    entry: TicketQueueEntry
  ): Identifier[] {

    const fields: {
      type: IdentifierType;
      value: string | null | undefined;
      reason: string;
    }[] = [
      {
        type: "phone",
        value: entry.phoneNumber,
        reason: "Shared phone number",
      },
      {
        type: "device",
        value: entry.deviceId,
        reason: "Shared device ID",
      },
      {
        type: "payment",
        value: entry.paymentAccount,
        reason: "Shared payment account",
      },
    ];

    return fields.flatMap(field => {

      const normalized = normalizeIdentifier(
        field.value,
        field.type
      );

      if (normalized === null) {
        return [];
      }

      return [{
        key: `${field.type}:${normalized}`,
        reason: field.reason,
      }];
    });
  }

  function buildFanGroups(
    entries: TicketQueueEntry[]
  ): FanGroup[] {

    const parent = entries.map((_, i) => i);
    const rank = entries.map(() => 0);

    function find(index: number): number {

      if (parent[index] !== index) {
        parent[index] = find(parent[index]);
      }

      return parent[index];
    }

    function union(a: number, b: number): void {

      let rootA = find(a);
      let rootB = find(b);

      if (rootA === rootB) return;

      // Union by rank
      if (rank[rootA] < rank[rootB]) {
        [rootA, rootB] = [rootB, rootA];
      }

      parent[rootB] = rootA;

      if (rank[rootA] === rank[rootB]) {
        rank[rootA]++;
      }
    }

    // Connect entries using shared identifiers
    const identifierMap = new Map<
      string,
      { index: number; reason: string }
    >();

    const connectionReasons = new Map<
      number,
      Set<string>
    >();

    entries.forEach((entry, index) => {

      for (const identifier of getIdentifiers(entry)) {

        const existing = identifierMap.get(identifier.key);

        if (existing) {

          union(index, existing.index);

        } else {

          identifierMap.set(identifier.key, {
            index,
            reason: identifier.reason,
          });
        }
      }
    });

    // Build connected components
    const groups = new Map<number, TicketQueueEntry[]>();

    entries.forEach((entry, index) => {

      const root = find(index);

      if (!groups.has(root)) {
        groups.set(root, []);
      }

      groups.get(root)!.push(entry);
    });

    // Collect reasons for each connected group
    for (const [key, value] of identifierMap) {

      const matchingEntries = entries.filter(entry =>
        getIdentifiers(entry).some(
          identifier => identifier.key === key
        )
      );

      if (matchingEntries.length < 2) continue;

      const root = find(value.index);

      if (!connectionReasons.has(root)) {
        connectionReasons.set(root, new Set());
      }

      connectionReasons.get(root)!.add(value.reason);
    }

    return Array.from(groups.entries()).map(
      ([root, groupEntries], index) => ({
        id: `fan-group-${index + 1}`,
        entries: groupEntries,
        representative: null,
        connectionReasons: Array.from(
          connectionReasons.get(find(root)) ?? []
        ),
      })
    );
  }
  
  function calculateScore(
    entry: TicketQueueEntry,
    now: Date,
    maxTicketValue: number
  ): RankedEntry {

    const weights = scoring;

    const loyaltyPoints = Math.max(
      0,
      entry.loyaltyPoints ?? 0
    );

    const loyaltyScore =
      Math.min(
        loyaltyPoints / weights.maxLoyaltyPoints,
        1
      ) * weights.loyalty;

    const waitedHours = Math.max(
      0,
      (now.getTime() -
        new Date(entry.joinedQueueAt).getTime()) /
        3600000
    );

    const waitingScore =
      Math.min(
        waitedHours / weights.maxWaitingHours,
        1
      ) * weights.waitingTime;

    const vipScore =
      entry.membership === "vip"
        ? weights.vip
        : 0;

    const ticketScore =
      (Number(entry.ticketValue) / maxTicketValue) *
      weights.ticketValue;

    const upgrades = Math.max(
      0,
      entry.upgradesLast30Days ?? 0
    );

    const upgradeScore =
      (
        1 -
        Math.min(
          upgrades / weights.maxUpgrades,
          1
        )
      ) * weights.upgradeHistory;

    const fairnessScore =
      Math.min(
        Math.max(
          waitedHours - weights.fairnessStartHours,
          0
        ) / 22,
        1
      ) * weights.fairness;

    const score =
      loyaltyScore +
      waitingScore +
      vipScore +
      ticketScore +
      upgradeScore +
      fairnessScore;

    return {
      entry,
      score: Number(score.toFixed(2)),
      reasons: [
        `Loyalty points: ${loyaltyScore.toFixed(2)}/${weights.loyalty}`,
        `Waiting time: ${waitingScore.toFixed(2)}/${weights.waitingTime}`,
        `VIP membership: ${vipScore}/${weights.vip}`,
        `Ticket value: ${ticketScore.toFixed(2)}/${weights.ticketValue}`,
        `Upgrade history: ${upgradeScore.toFixed(2)}/${weights.upgradeHistory}`,
        `Fairness bonus: ${fairnessScore.toFixed(2)}/${weights.fairness}`,
      ],
    };
  }

  function compareRankedEntries(
    a: RankedEntry,
    b: RankedEntry
  ): number {

    if (a.score !== b.score) {
      return b.score - a.score;
    }

    const timeA = new Date(
      a.entry.joinedQueueAt
    ).getTime();

    console.log("timeA", timeA);
    
    const timeB = new Date(
      b.entry.joinedQueueAt
    ).getTime();

    if (timeA !== timeB) {
      return timeA - timeB;
    }

    return a.entry.id.localeCompare(b.entry.id);
  }

  function selectRepresentatives(
    fanGroups: FanGroup[],
    now: Date,
    maxTicketValue: number
  ): FanGroup[] {

    return fanGroups.map(group => {

      const candidates = group.entries
        .map(entry =>
          calculateScore(entry, now, maxTicketValue)
        )
        .sort(compareRankedEntries);

      return {
        ...group,
        representative: candidates[0] ?? null,
      };
    });
  }
  
  function selectWinner(
    fanGroups: FanGroup[]
  ): RankedEntry | null {

    const representatives = fanGroups
      .map(group => group.representative)
      .filter(
        (entry): entry is RankedEntry =>
          entry !== null
      );

    if (representatives.length === 0) {
      return null;
    }

    representatives.sort(compareRankedEntries);

    return representatives[0];
  }

  function buildWinnerReasons(
    winner: RankedEntry | null,
    fanGroups: FanGroup[]
  ): RankedEntry | null {

    if (!winner) {
      return null;
    }

    const totalGroups = fanGroups.filter(
      group => group.representative !== null
    ).length;

    return {
      ...winner,
      reasons: [
        ...winner.reasons,
        `Selected as the highest-ranked representative among ${totalGroups} fan groups.`,
        "Each fan group receives only one representative, regardless of linked account count.",
        "Ranking is determined by total score, with earlier queue time used as the tie-breaker."
      ],
    };
  }

  function buildFrontRowUpgradeQueue(
    entries: TicketQueueEntry[],
    now: Date,
  ): FrontRowUpgradeResult {

    if (!Number.isFinite(now.getTime())) {
      throw new Error("Invalid current time");
    }

    // STEP 1: Remove entries that cannot receive an upgrade
    const {
      eligibleEntries,
      excludedEntries,
    } = filterEligibleEntries(entries, now);

    // STEP 2: Find accounts belonging to the same fan group
    const initialGroups = buildFanGroups(eligibleEntries);

    // STEP 3: Choose one representative per fan group
    const maxTicketValue = eligibleEntries.reduce(
      (max, entry) =>
        Math.max(max, Number(entry.ticketValue)),
      0
    );

    const fanGroups = selectRepresentatives(
      initialGroups,
      now,
      maxTicketValue
    );

    // STEP 4: Choose one winner from all representatives
    const selectedWinner = selectWinner(fanGroups);

    // STEP 5: Explain why the winner was selected
    const winner = buildWinnerReasons(
      selectedWinner,
      fanGroups
    );

    return {
      winner,
      fanGroups,
      excludedEntries,
    };
  }


  function addItem() {
    const newList = Array.from(list)
    console.log("obj", obj);
    console.log(new Date());
    console.log(buildFrontRowUpgradeQueue(obj, new Date("Tue, 19 Aug 1975 23:00:30 GMT")));
    //newList.push(buildFrontRowUpgradeQueue(obj, new Date()).winner?.entry.fanName ?? "No Winner")
    newList.push(buildFrontRowUpgradeQueue(obj, new Date("Tue, 19 Aug 1975 23:00:30 GMT")).winner?.entry.fanName ?? "No Winner")
    setList(newList)
  }

  function onChangeItem(event: React.ChangeEvent<HTMLInputElement>) {
    console.log(event)
    setWord(event.target.value)
  }

  function removeItem(item: string) {
    console.log("click", item)
    let newList = Array.from(list)
    newList = newList.filter(rawItem => {
      if(item == rawItem){
        return false
      }
      return true
    })
    setList(newList)
  }

  return (
    <div className="list-container">
      <div className="input-section">
        <input 
          type="text" 
          className="add-input" 
          placeholder="add item . . ." 
          onChange={onChangeItem}
          value={word}
        />
        <br />
        <button className="add-btn" onClick={addItem}>ADD</button>
        <p>ปัจจุบัน: {word}</p>
      </div>
      
      <div className="items-wrapper">
        {list.map(item => {
          return <ListItem key={item} taskName={item} removeTask={removeItem}></ListItem>
        })}
      </div>
    </div>
  );
}

export default List;