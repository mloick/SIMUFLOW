# Module natif local de SimuFlow : lecture du texte d'une photo avec Vision.
Pod::Spec.new do |s|
  s.name           = 'TextRecognition'
  s.version        = '1.0.0'
  s.summary        = 'Lecture du texte d’une photo sur l’appareil (Vision)'
  s.description    = 'Module Expo local de SimuFlow : reconnaissance de texte avec le framework Vision d’Apple, sans réseau.'
  s.author         = ''
  s.homepage       = 'https://docs.expo.dev/modules/'
  s.platforms      = {
    :ios => '16.4'
  }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.frameworks = 'Vision'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = "**/*.{h,m,mm,swift}"
end
