import { ScanRecord, SecurityFinding } from '../types/scanner';

export interface ScanComparisonResult {
  previousScan: ScanRecord;
  currentScan: ScanRecord;
  scoreDelta: number;
  resolved: SecurityFinding[];
  remaining: SecurityFinding[];
  newlyDetected: SecurityFinding[];
}

function getFindingKey(f: SecurityFinding): string {
  return `${f.ruleId}::${f.filePath}::${f.lineNumber}`;
}

export function compareScans(
  currentScan: ScanRecord,
  previousScan: ScanRecord
): ScanComparisonResult {
  const prevMap = new Map<string, SecurityFinding>();
  for (const finding of previousScan.findings) {
    prevMap.set(getFindingKey(finding), finding);
  }

  const currMap = new Map<string, SecurityFinding>();
  for (const finding of currentScan.findings) {
    currMap.set(getFindingKey(finding), finding);
  }

  const resolved: SecurityFinding[] = [];
  const remaining: SecurityFinding[] = [];
  const newlyDetected: SecurityFinding[] = [];

  for (const [key, prevFinding] of prevMap.entries()) {
    if (currMap.has(key)) {
      remaining.push(currMap.get(key)!);
    } else {
      resolved.push(prevFinding);
    }
  }

  for (const [key, currFinding] of currMap.entries()) {
    if (!prevMap.has(key)) {
      newlyDetected.push(currFinding);
    }
  }

  return {
    previousScan,
    currentScan,
    scoreDelta: currentScan.securityScore - previousScan.securityScore,
    resolved,
    remaining,
    newlyDetected,
  };
}
