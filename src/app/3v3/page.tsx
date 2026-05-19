import StatsView from '@/components/StatsView';

export default function Page3v3() {
  return (
    <StatsView
      dataUrl="/data/maps_3v3.json"
      footer="3v3 winrate data · top 15,000 players · ~1250 ELO and above · last 180 days"
    />
  );
}
