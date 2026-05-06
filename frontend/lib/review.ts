// Mapping des critères backend → clés i18n frontend
export const CRITERIA_I18N_MAP: Record<string, string> = {
  ponctualite: 'criteria_punctuality',
  communication: 'criteria_communication',
  soin_colis: 'criteria_package_care',
  conformite: 'criteria_compliance',
  colis_prepare: 'criteria_package_prepared',
  ponctualite_depot: 'criteria_dropoff_punctuality',
  serieux: 'criteria_reliability',
  disponibilite: 'criteria_availability',
  ponctualite_remise: 'criteria_delivery_punctuality',
  professionnalisme: 'criteria_professionalism',
}

export const CRITERIA_BY_ROLE: Record<string, string[]> = {
  sender_to_carrier: ['ponctualite', 'communication', 'soin_colis', 'conformite'],
  carrier_to_sender: ['communication', 'colis_prepare', 'ponctualite_depot', 'serieux'],
  carrier_to_receiver: ['disponibilite', 'ponctualite_remise', 'communication'],
  receiver_to_carrier: ['ponctualite', 'communication', 'soin_colis', 'professionnalisme'],
}
