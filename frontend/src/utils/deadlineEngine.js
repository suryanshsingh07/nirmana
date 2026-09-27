/**
 * Frontend Deadline Engine: Deterministic Ambiguity Analysis, Date Normalization,
 * Chronological Sorting, and Exact 48-Hour Cluster Detection.
 */

export function getReferenceDate() {
  return new Date();
}

export function formatDateISO(date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function parseRelativeDate(phrase, refDate = getReferenceDate()) {
  const lower = (phrase || '').toLowerCase().trim();
  const result = new Date(refDate);

  if (lower.includes('tomorrow')) {
    result.setDate(result.getDate() + 1);
    return formatDateISO(result);
  }

  const daysOfWeek = {
    sunday: 0,
    monday: 1,
    tuesday: 2,
    wednesday: 3,
    thursday: 4,
    friday: 5,
    saturday: 6,
  };

  for (const [dayName, dayNum] of Object.entries(daysOfWeek)) {
    if (lower.includes(dayName)) {
      const currentDay = result.getDay();
      let distance = dayNum - currentDay;
      if (distance <= 0) distance += 7;
      if (lower.includes('next') && distance < 7) distance += 7;
      result.setDate(result.getDate() + distance);
      return formatDateISO(result);
    }
  }

  result.setDate(result.getDate() + 7);
  return formatDateISO(result);
}

export function extractExplicitTime(text) {
  if (!text) return null;
  const timeRegex = /\b([01]?\d|2[0-3]):([0-5]\d)\s*(am|pm)?\b|\b([1-9]|1[0-2])\s*(am|pm)\b/i;
  const match = text.match(timeRegex);
  if (!match) return null;

  let hours, minutes = '00';

  if (match[1] !== undefined && match[2] !== undefined) {
    hours = parseInt(match[1], 10);
    minutes = match[2];
    const meridiem = match[3] ? match[3].toLowerCase() : null;
    if (meridiem === 'pm' && hours < 12) hours += 12;
    if (meridiem === 'am' && hours === 12) hours = 0;
  } else if (match[4] !== undefined && match[5] !== undefined) {
    hours = parseInt(match[4], 10);
    const meridiem = match[5].toLowerCase();
    if (meridiem === 'pm' && hours < 12) hours += 12;
    if (meridiem === 'am' && hours === 12) hours = 0;
  }

  return `${String(hours).padStart(2, '0')}:${minutes}`;
}

export function analyzeDeadlineAmbiguity(text, extractedDateRaw = null) {
  if (!text) text = '';
  const cleanText = text.trim();

  // 1. Conflicting Dates in same text
  const monthNamesPattern = /(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2}(?:\s*,\s*\d{4}|\s+\d{4})?/gi;
  const dateMatches = cleanText.match(monthNamesPattern) || [];

  if (dateMatches.length >= 2) {
    const uniqueDates = Array.from(new Set(dateMatches.map(m => m.trim())));
    if (uniqueDates.length >= 2) {
      return {
        ambiguityType: 'conflicting_dates',
        status: 'conflicting',
        detectedPhrase: uniqueDates.join(' vs '),
        conflictingDates: uniqueDates,
        message: '⚠ Conflicting deadlines detected in announcement text.',
      };
    }
  }

  // 2. Ambiguous Numeric Date (e.g. "10/11")
  const numericDateRegex = /\b([0-1]?\d)[\/\.-]([0-3]?\d)(?:[\/\.-](\d{2,4}))?\b/;
  const numMatch = cleanText.match(numericDateRegex);
  if (numMatch) {
    const num1 = parseInt(numMatch[1], 10);
    const num2 = parseInt(numMatch[2], 10);
    const yearPart = numMatch[3] ? (numMatch[3].length === 2 ? `20${numMatch[3]}` : numMatch[3]) : '2026';

    if (num1 >= 1 && num1 <= 12 && num2 >= 1 && num2 <= 12 && num1 !== num2) {
      const dateOptionA = `${yearPart}-${String(num1).padStart(2, '0')}-${String(num2).padStart(2, '0')}`;
      const dateOptionB = `${yearPart}-${String(num2).padStart(2, '0')}-${String(num1).padStart(2, '0')}`;

      const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      const labelA = `${num2} ${monthNames[num1 - 1]} ${yearPart} (MM/DD)`;
      const labelB = `${num1} ${monthNames[num2 - 1]} ${yearPart} (DD/MM)`;

      return {
        ambiguityType: 'ambiguous_numeric_date',
        status: 'needs_verification',
        detectedPhrase: numMatch[0],
        ambiguousOptions: [
          { label: labelA, date: dateOptionA },
          { label: labelB, date: dateOptionB },
        ],
        message: `⚠ Ambiguous numeric date format "${numMatch[0]}". Please verify month vs day.`,
      };
    }
  }

  // 3. Relative Date (e.g. "next Friday")
  const relativeRegex = /\b(next|this|coming)\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)|tomorrow|due next week\b/i;
  const relMatch = cleanText.match(relativeRegex);
  if (relMatch) {
    const phrase = relMatch[0];
    const suggested = parseRelativeDate(phrase);
    return {
      ambiguityType: 'relative_date',
      status: 'needs_verification',
      detectedPhrase: phrase,
      suggestedDate: suggested,
      message: `⚠ Needs verification. Detected phrase: "${phrase}".`,
    };
  }

  // 4. Missing Year (e.g. "October 15")
  const monthNoYearRegex = /\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(\d{1,2})\b(?!\s*,\s*\d{4}|\s+\d{4})/i;
  const missingYearMatch = cleanText.match(monthNoYearRegex);
  if (missingYearMatch) {
    const monthStr = missingYearMatch[1];
    const dayNum = parseInt(missingYearMatch[2], 10);
    const monthsMap = {
      jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4,
      may: 5, jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8, sep: 9, september: 9,
      oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12
    };
    const mm = monthsMap[monthStr.toLowerCase()] || 10;
    const currentYear = getReferenceDate().getFullYear();
    const suggestedDate = `${currentYear}-${String(mm).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;

    return {
      ambiguityType: 'missing_year',
      status: 'needs_verification',
      detectedPhrase: missingYearMatch[0],
      suggestedYear: currentYear,
      suggestedDate: suggestedDate,
      message: '⚠ Needs verification — Year missing from source.',
    };
  }

  // 5. Explicit Clear Date
  return {
    ambiguityType: 'none',
    status: 'verified',
    detectedPhrase: extractedDateRaw || null,
    message: null,
  };
}

export function extractSingleAnnouncementClient(text, index) {
  if (!text || !text.trim()) {
    return {
      id: `announcement_${index + 1}_${Date.now()}`,
      announcementIndex: index,
      originalText: '',
      title: `Assignment ${index + 1}`,
      subject: 'General',
      deadlineDate: '',
      deadlineTime: null,
      hasExplicitTime: false,
      supportingSource: 'No source text provided.',
      status: 'needs_verification',
      ambiguityType: 'unparseable',
      message: 'Could not confidently extract a deadline from this announcement.',
    };
  }

  const cleanText = text.trim();

  let title = `Assignment ${index + 1}`;
  let subject = 'General';

  const subjectPatterns = [
    { name: 'Database Management Systems', regex: /\b(dbms|database|sql)\b/i },
    { name: 'Operating Systems', regex: /\b(operating systems|os lab|os)\b/i },
    { name: 'Artificial Intelligence', regex: /\b(artificial intelligence|ai project|ai)\b/i },
    { name: 'Computer Networks', regex: /\b(computer networks|networks|cn)\b/i },
    { name: 'Web Development', regex: /\b(web development|web dev|frontend|react)\b/i },
    { name: 'Software Engineering', regex: /\b(software engineering|se report|se)\b/i },
    { name: 'Data Structures', regex: /\b(data structures|dsa|algo)\b/i },
  ];

  for (const s of subjectPatterns) {
    if (s.regex.test(cleanText)) {
      subject = s.name;
      break;
    }
  }

  const titleMatch = cleanText.match(/^([^.\n:]+)(?:is due|must be|due|assignment|report|project)/i) ||
                     cleanText.match(/^([^.\n:]+)/);

  if (titleMatch && titleMatch[1].trim().length > 2) {
    title = titleMatch[1].trim();
  }

  const sentences = cleanText.split(/(?<=[.!?])\s+/);
  let supportingSource = sentences.find(s => /due|deadline|submit|report/i.test(s)) || sentences[0] || cleanText;
  if (supportingSource.length > 150) {
    supportingSource = supportingSource.slice(0, 147) + '...';
  }

  const explicitTime = extractExplicitTime(cleanText);
  const ambiguityInfo = analyzeDeadlineAmbiguity(cleanText);

  let deadlineDate = '';
  if (ambiguityInfo.suggestedDate) {
    deadlineDate = ambiguityInfo.suggestedDate;
  } else {
    const monthYearMatch = cleanText.match(/\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(\d{1,2})\s*,\s*(\d{4})\b/i);
    if (monthYearMatch) {
      const monthStr = monthYearMatch[1].toLowerCase();
      const dayNum = parseInt(monthYearMatch[2], 10);
      const yearNum = monthYearMatch[3];
      const monthsMap = {
        jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4,
        may: 5, jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8, sep: 9, september: 9,
        oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12
      };
      const mm = monthsMap[monthStr] || 10;
      deadlineDate = `${yearNum}-${String(mm).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
    } else {
      const fullDateMatch = cleanText.match(/\b(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})\b/);
      if (fullDateMatch) {
        deadlineDate = `${fullDateMatch[1]}-${String(fullDateMatch[2]).padStart(2, '0')}-${String(fullDateMatch[3]).padStart(2, '0')}`;
      }
    }
  }

  return {
    id: `announcement_${index + 1}_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
    announcementIndex: index,
    originalText: cleanText,
    title: title,
    subject: subject,
    deadlineDate: deadlineDate,
    deadlineTime: explicitTime,
    hasExplicitTime: !!explicitTime,
    supportingSource: supportingSource,
    status: ambiguityInfo.status,
    ambiguityType: ambiguityInfo.ambiguityType,
    detectedPhrase: ambiguityInfo.detectedPhrase || null,
    suggestedDate: ambiguityInfo.suggestedDate || null,
    suggestedYear: ambiguityInfo.suggestedYear || null,
    conflictingDates: ambiguityInfo.conflictingDates || null,
    ambiguousOptions: ambiguityInfo.ambiguousOptions || null,
    message: ambiguityInfo.message || null,
  };
}

/**
 * Exact 48-Hour Deadline Cluster Detection Algorithm
 */
export function detectDeadlineClusters(verifiedItems = []) {
  if (!Array.isArray(verifiedItems) || verifiedItems.length < 3) {
    return {
      sortedVerifiedItems: verifiedItems || [],
      clusters: [],
      clusteredItemIds: [],
      hasClusters: false,
    };
  }

  // 1. Strictly VERIFIED deadlines only
  const validVerified = verifiedItems.filter(
    (item) => item.status === 'verified' && item.deadlineDate
  );

  // 2. Convert to normalized Date objects using internal 23:59 rule for date-only deadlines
  const normalizedList = validVerified.map((item) => {
    let dt;
    if (item.hasExplicitTime && item.deadlineTime) {
      dt = new Date(`${item.deadlineDate}T${item.deadlineTime}:00`);
    } else {
      dt = new Date(`${item.deadlineDate}T23:59:00`);
    }
    return {
      ...item,
      normalizedDate: dt,
      timestamp: dt.getTime(),
    };
  });

  // 3. Sort chronologically by application code
  normalizedList.sort((a, b) => a.timestamp - b.timestamp);

  const MS_PER_HOUR = 3600 * 1000;
  const WINDOW_MS = 48 * MS_PER_HOUR;

  const rawClusters = [];
  const clusteredItemIdsSet = new Set();
  const n = normalizedList.length;

  for (let i = 0; i < n; i++) {
    let group = [normalizedList[i]];
    for (let j = i + 1; j < n; j++) {
      const diffMs = normalizedList[j].timestamp - normalizedList[i].timestamp;
      if (diffMs <= WINDOW_MS) {
        group.push(normalizedList[j]);
      } else {
        break;
      }
    }

    if (group.length >= 3) {
      const earliestMs = group[0].timestamp;
      const latestMs = group[group.length - 1].timestamp;
      const spanHours = (latestMs - earliestMs) / MS_PER_HOUR;

      rawClusters.push({
        id: `cluster_${i}_${group.length}_${earliestMs}`,
        items: group,
        count: group.length,
        earliestDate: group[0].normalizedDate,
        latestDate: group[group.length - 1].normalizedDate,
        spanHours: Math.round(spanHours * 100) / 100,
      });

      group.forEach((item) => clusteredItemIdsSet.add(item.id));
    }
  }

  const uniqueClusters = [];
  for (const c of rawClusters) {
    const isContained = uniqueClusters.some((existing) =>
      c.items.every((cItem) => existing.items.some((eItem) => eItem.id === cItem.id))
    );
    if (!isContained) {
      uniqueClusters.push(c);
    }
  }

  return {
    sortedVerifiedItems: normalizedList,
    clusters: uniqueClusters,
    clusteredItemIds: Array.from(clusteredItemIdsSet),
    hasClusters: uniqueClusters.length > 0,
  };
}
