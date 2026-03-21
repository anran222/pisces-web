const MENU_FLIP_ROW_COUNT = 2

export const getActionMenuPlacement = (rowIndex, totalRows) => {
  const normalizedIndex = Number.isInteger(rowIndex) ? rowIndex : 0
  const normalizedTotalRows = Number.isInteger(totalRows) ? totalRows : 0
  const shouldOpenUpward = normalizedTotalRows > 0
    && normalizedIndex >= Math.max(0, normalizedTotalRows - MENU_FLIP_ROW_COUNT)

  return shouldOpenUpward ? 'bottom-full mb-1' : 'top-full mt-1'
}
