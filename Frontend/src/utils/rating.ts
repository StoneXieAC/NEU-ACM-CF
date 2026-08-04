export function getRatingTierClass(rating: number | null) {
  if (rating === null) return 'rating-none'
  if (rating < 1200) return 'rating-gray'
  if (rating < 1400) return 'rating-green'
  if (rating < 1600) return 'rating-cyan'
  if (rating < 1900) return 'rating-blue'
  if (rating < 2100) return 'rating-violet'
  if (rating < 2400) return 'rating-orange'
  return 'rating-red'
}

export function getRatingClass(rating: number | null, totalContests: number) {
  if (rating === null) return 'rating-none'
  if (totalContests <= 5) return 'rating-newbie'
  return getRatingTierClass(rating)
}
