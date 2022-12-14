import { ODataError, ODataExpand, ODataExpandQuery, ODataQuery } from '@albanian-xrm/dataverse-odata/OData.types';
import { getSelectFromParser } from './getSelectFromParser';

/**
 * Parses the $expand query
 * @returns Returns true when the parse has an error
 */
export const getExpandFromParser = (parser: URLSearchParams, result: ODataQuery): boolean => {
    const $expand = parser.get('$expand');
    if ($expand !== null) {
        result.$expand = {};

        if (extractExpand($expand, result)) {
            return true;
        }
    }
    return false;
}


const extractExpand = (value: string, $expand: ODataExpand & ODataError) => {
    const match = value.match(/^\s*(\w(\w|\d|_)*)\s*(,|\()?\s*/);
    if (match === null ||
        match[0].length < value.length && match[3] === null ||
        match[0].length === value.length && match[3] !== undefined) {
        $expand.error = {
            code: '0x0',
            message: 'invalid expand expression'
        }
        return true;
    }
    let matchSeparator = match[3];
    let matchLength = match[0].length;
    if (matchSeparator !== '(') {
        if ($expand.$expand !== undefined) {
            $expand.$expand[match[1]] = { $select: [] };
        }
    } else {
        const { index, error } = getClosingBracket(value.substring(matchLength))
        if (error) {
            $expand.error = {
                code: '0x0',
                message: error
            }
            return true;
        }

        if ($expand.$expand !== undefined) {
            const innerExpand = {} as ODataExpandQuery & ODataError;
            const parser = new URLSearchParams('?' + value.substring(matchLength, matchLength + index));
            if (getSelectFromParser(parser, innerExpand)) {
                $expand.error = innerExpand.error;
                return true;
            }
            if (getExpandFromParser(parser, innerExpand)) {
                $expand.error = innerExpand.error;
                return true;
            }
            if (innerExpand.$expand === undefined && innerExpand.$select === undefined) {
                $expand.error = { code: '0x0', message: 'Empty expand' };
                return true;
            }
            $expand.$expand[match[1]] = innerExpand;
        }

        matchLength = matchLength + index;
        const secondMatch = value.substring(matchLength + 1).match(/\s*(,?)\s*d/);
        if (secondMatch !== null) {
            matchLength = matchLength + secondMatch[0].length;
            if (secondMatch[1] !== null) {
                matchSeparator = ',';
            }
        }
    }

    if (matchSeparator === ',') {
        if (extractExpand(value.substring(matchLength), $expand)) {
            return true;
        }
    }

    return false;
}

const getClosingBracket = (value: string): { index: number, error?: string } => {
    let depth = 1;
    let startAt = 0;
    while (depth > 0) {
        const match = value.substring(startAt).match(/\(|\)/);
        if (match === null) {
            return { error: 'no closing bracket found', index: -1 };
        }
        if (match[0] === ')') {
            depth -= 1;
            if (depth === 0) {
                return { index: match.index || 0 };
            }
        } else {
            depth += 1;
        }
        startAt = (match.index || 0) + 1;
    }
    return { error: 'no closing bracket found', index: -1 };
}
