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

  type Identifier = {
    key: string;
    reason: string;
  };

  // Scoring configuration
  const SCORING = {
    MAX_LOYALTY_POINTS: 1000,
    MAX_WAIT_HOURS: 24,
    MAX_TICKET_SCORE: 15,
    MAX_UPGRADES: 3,

    WEIGHTS: {
      loyalty: 25,
      waitingTime: 30,
      vip: 15,
      ticketValue: 15,
      upgradeHistory: 10,
      fairness: 5,
    },
  } as const;

  const [word, setWord] = useState("")
  const [list, setList] = useState<string[]>([])

  const obj = JSON.parse(JSON.stringify(dataQueue)) as TicketQueueEntry[];


function normalizeIdentifier(
  value: string | null | undefined,
  type: "phone" | "device" | "payment"
): string | null {

  if (value == null || !value.trim()) {
    return null;
  }

  //const normalized = value.trim().toLowerCase();

  switch (type) {
    case "phone":
      return value.replace(/\D/g, "");

    case "device":
      // Exact full string matching
      // Ignore leading/trailing spaces and letter casing
      return value.trim().toLowerCase();

    case "payment":
      // Exact full string matching
      // Ignore leading/trailing spaces and letter casing
      return value.trim().toLowerCase();

    default:
      return null;
  }
}

  function getIdentifiers(
    entry: TicketQueueEntry
  ): Identifier[] {

    const fields = [
      {
        type: "phone" as const,
        value: entry.phoneNumber,
        reason: "Shared phone number",
      },
      {
        type: "device" as const,
        value: entry.deviceId,
        reason: "Shared device ID",
      },
      {
        type: "payment" as const,
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
    entries: TicketQueueEntry[],
    rankedEntries: Map<TicketQueueEntry, RankedEntry>
  ): FanGroup[] {

    const parent = entries.map((_, index) => index);

    // Find root with path compression
    function find(index: number): number {

      if (parent[index] !== index) {
        parent[index] = find(parent[index]);
      }

      return parent[index];
    }

    // Merge two groups
    function union(a: number, b: number): void {

      const rootA = find(a);
      const rootB = find(b);

      if (rootA !== rootB) {
        parent[rootB] = rootA;
      }
    }

    // Map identifiers to their first entry
    const identifierMap = new Map<
      string,
      { index: number; reason: string }
    >();

    // STEP 1: Connect entries by 3 identifiers
    entries.forEach((entry, index) => {

      const identifiers = getIdentifiers(entry);

      for (const identifier of identifiers) {

        const existing = identifierMap.get(
          identifier.key
        );

        if (existing) {

          // Same identifier = same fan group
          union(index, existing.index);

        } else {

          identifierMap.set(identifier.key, {
            index,
            reason: identifier.reason,
          });
        }
      }
    });

    // STEP 2: Build connected groups
    const groups = new Map<
      number,
      {
        entries: TicketQueueEntry[];
        reasons: Set<string>;
      }
    >();

    entries.forEach((entry, index) => {

      const root = find(index);

      if (!groups.has(root)) {
        groups.set(root, {
          entries: [],
          reasons: new Set(),
        });
      }

      groups.get(root)!.entries.push(entry);
    });

    // STEP 3: Collect connection reasons
    for (const [key, value] of identifierMap) {

      const matchingEntries = entries.filter(
        entry => getIdentifiers(entry).some(
          identifier => identifier.key === key
        )
      );

      if (matchingEntries.length < 2) {
        continue;
      }

      const root = find(value.index);

      groups.get(root)!.reasons.add(value.reason);
    }

    // STEP 4: Select representative per group
    return Array.from(groups.values()).map(
      (group, index) => {

        const candidates = group.entries
          .map(entry => rankedEntries.get(entry))
          .filter(
            (item): item is RankedEntry =>
              item !== undefined
          )
          .sort(compareRankedEntries);

        return {
          id: `fan-group-${index + 1}`,
          entries: group.entries,
          representative: candidates[0] ?? null,
          connectionReasons: Array.from(group.reasons),
        };
      }
    );
  }
    
  function buildFrontRowUpgradeQueue(
      entries: TicketQueueEntry[],
      now: Date,
    ): FrontRowUpgradeResult {

      // 1. Validate entries
      const eligibleEntries: TicketQueueEntry[] = [];
      const excludedEntries: ExcludedEntry[] = [];

      for (const entry of entries) {
          //console.log("entry", entry)
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


    // 2. Calculate maximum ticket value
    const maxTicketValue = Math.max(
      0,
      ...eligibleEntries.map(entry =>
        Number(entry.ticketValue)
      )
    );

    // 3. Calculate score for eligible entries
    const rankedEntries = new Map<
      TicketQueueEntry,
      RankedEntry
    >();

    for (const entry of eligibleEntries) {

      const ranked = calculateScore(
        entry,
        now,
        maxTicketValue
      );

      rankedEntries.set(entry, ranked);
    }

    // 4. Group related fans
    // Include excluded entries to preserve all entries
    const fanGroups = buildFanGroups(
      entries,
      rankedEntries
    );

    // 5. Select representative from each group
    // Only eligible entries can become representatives
    const representatives = fanGroups
      .map(group => group.representative)
      .filter(
        (item): item is RankedEntry => item !== null
      )
      .sort(compareRankedEntries);

    // 6. Select overall winner
    const winner = representatives[0] ?? null;

    // 7. Return final result
    return {
      winner,
      fanGroups,
      excludedEntries,
    };
  }

  function compareRankedEntries(
    a: RankedEntry,
    b: RankedEntry
  ): number {

    // Higher score first
    if (a.score !== b.score) {
      return b.score - a.score;
    }

    // Earlier queue time first
    const timeA = new Date(
      a.entry.joinedQueueAt
    ).getTime();

    const timeB = new Date(
      b.entry.joinedQueueAt
    ).getTime();

    if (timeA !== timeB) {
      return timeA - timeB;
    }

    // Stable tie-breaker
    return a.entry.id.localeCompare(b.entry.id);
  }

  function validateEntry(entry: TicketQueueEntry, now: Date): string | null {
    // Rule 1: Entry is cancelled
    if (entry.status === "cancelled") {
      return "Cancelled entry";
    }

    // Rule 2: Entry was already upgraded
    if (entry.status === "upgraded") {
      return "Already upgraded";
    }

    // Rule 3: Concert has already started
    const eventStart = new Date(entry.eventStartsAt);

    if (Number.isNaN(eventStart.getTime())) {
      return "Invalid event start time";
    }

    if (now.getTime() >= eventStart.getTime()) {
      return "Concert has already started";
    }

    // Rule 4: Fan is blocked
    if (entry.membership === "blocked") {
      return "Fan is blocked";
    }

    // Rule 5: Ticket value must be valid and positive
    const ticketValue =
      typeof entry.ticketValue === "string"
        ? Number(entry.ticketValue.trim())
        : entry.ticketValue;

    if (
      ticketValue === null ||
      ticketValue === undefined ||
      typeof ticketValue !== "number" ||
      !Number.isFinite(ticketValue) ||
      ticketValue <= 0
    ) {
      return "Invalid ticket value";
    }

    // Additional data validation
    const queueTime = new Date(entry.joinedQueueAt);

    if (Number.isNaN(queueTime.getTime())) {
      return "Invalid queue join time";
    }

    return null;
  }

  function getTicketValue(
    entry: TicketQueueEntry
  ): number {
    return Number(entry.ticketValue);
  }

  function getSafeNumber(
    value: number | null | undefined
  ): number {
    if (value == null || !Number.isFinite(value)) {
      return 0;
    }

    return Math.max(0, value);
  }

  function calculateScore(
    entry: TicketQueueEntry,
    now: Date,
    maxTicketValue: number
  ): RankedEntry {

    const weights = SCORING.WEIGHTS;

    // 1. Loyalty Points (0 - 25)
    const loyaltyPoints = getSafeNumber(
      entry.loyaltyPoints
    );

    const loyaltyScore =
      Math.min(
        loyaltyPoints / SCORING.MAX_LOYALTY_POINTS,
        1
      ) * weights.loyalty;

    // 2. Waiting Time (0 - 30)
    const joinedAt = new Date(entry.joinedQueueAt);

    const waitedMs = Math.max(
      0,
      now.getTime() - joinedAt.getTime()
    );

    const waitedHours =
      waitedMs / (1000 * 60 * 60);

    const waitingScore =
      Math.min(
        waitedHours / SCORING.MAX_WAIT_HOURS,
        1
      ) * weights.waitingTime;

    // 3. VIP Membership (0 - 15)
    const vipScore =
      entry.membership === "vip"
        ? weights.vip
        : 0;

    // 4. Ticket Value (0 - 15)
    const ticketValue = getTicketValue(entry);

    const ticketScore =
      (ticketValue / maxTicketValue) *
      weights.ticketValue;

    // 5. Upgrade History (0 - 10)
    const upgrades = getSafeNumber(
      entry.upgradesLast30Days
    );

    const upgradeScore =
      (
        1 -
        Math.min(
          upgrades / SCORING.MAX_UPGRADES,
          1
        )
      ) * weights.upgradeHistory;

    // 6. Fairness Bonus (0 - 5)
    // Starts after waiting for 2 hours
    const fairnessScore =
      Math.min(
        Math.max(waitedHours - 2, 0) / 22,
        1
      ) * weights.fairness;

    const totalScore =
      loyaltyScore +
      waitingScore +
      vipScore +
      ticketScore +
      upgradeScore +
      fairnessScore;

    return {
      entry,
      score: Number(totalScore.toFixed(2)),
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


  function addItem() {
    const newList = Array.from(list)
    console.log("obj", obj)
    console.log(buildFrontRowUpgradeQueue(obj, new Date()));
    //newList.push(buildFrontRowUpgradeQueue(obj, new Date()).winner?.entry.fanName ?? "No Winner")
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