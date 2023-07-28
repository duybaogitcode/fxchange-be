class Calculate {
  public reduceExchangePending(reputationScore: number, userPoint: number) {
    if (reputationScore === 100) {
      return 0;
    }
    const reputationScoreCount = (100 - reputationScore) / 10;
    const pendingPercentage = Math.max(0, reputationScoreCount * 10);
    const pendingNewPoint = userPoint - Math.floor((userPoint * (100 - pendingPercentage)) / 100);
    return pendingNewPoint;
  }

  public reduceExchangeOngoing(reputationScore: number, userPoint: number) {
    if (reputationScore === 100) {
      return 0;
    }
    const reputationScoreCount = (100 - reputationScore) / 10;
    const ongoingPercentage = Math.max(0, reputationScoreCount * 10 + 5);
    const ongoingNewPoint = userPoint - Math.floor((userPoint * (100 - ongoingPercentage)) / 100);
    return ongoingNewPoint;
  }

  public reduceMarketPending(stuffPrice: number) {
    const reducePoint = stuffPrice - Math.floor((stuffPrice * 90) / 100);
    return reducePoint;
  }

  public reduceMarketOngoing(stuffPrice: number) {
    const reducePoint = stuffPrice - Math.floor((stuffPrice * 80) / 100);
    return reducePoint;
  }
}
export default new Calculate();
