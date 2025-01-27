import colors from '@celo/react-components/styles/colors'
import { fontStyles } from '@celo/react-components/styles/fonts'
import { componentStyles } from '@celo/react-components/styles/styles'
import { throttle } from 'lodash'
import * as React from 'react'
import { withNamespaces, WithNamespaces } from 'react-i18next'
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'
import { NavigationInjectedProps, NavigationScreenProps, withNavigation } from 'react-navigation'
import { connect } from 'react-redux'
import { hideAlert, showError } from 'src/alert/actions'
import CeloAnalytics from 'src/analytics/CeloAnalytics'
import { CustomEventNames } from 'src/analytics/constants'
import { componentWithAnalytics } from 'src/analytics/wrapper'
import { ErrorMessages } from 'src/app/ErrorMessages'
import CancelButton from 'src/components/CancelButton'
import { ALERT_BANNER_DURATION } from 'src/config'
import { Namespaces } from 'src/i18n'
import { importContacts } from 'src/identity/actions'
import { E164NumberToAddressType } from 'src/identity/reducer'
import { navigate } from 'src/navigator/NavigationService'
import { Screens } from 'src/navigator/Screens'
import {
  filterRecipientFactory,
  filterRecipients,
  Recipient,
  RecipientKind,
  RecipientWithQrCode,
} from 'src/recipients/recipient'
import RecipientPicker from 'src/recipients/RecipientPicker'
import { recipientCacheSelector } from 'src/recipients/reducer'
import { RootState } from 'src/redux/reducers'
import { storeLatestInRecents } from 'src/send/actions'
import { checkContactsPermission } from 'src/utils/androidPermissions'

const SEARCH_THROTTLE_TIME = 50
const defaultRecipientPhoneNumber = '+10000000000'
const defaultRecipientAddress = `0xce10ce10ce10ce10ce10ce10ce10ce10ce10ce10`

// For alfajores-net users to be able to send a small transaction to a sample address (remove post-alfajores)
export const CeloDefaultRecipient: RecipientWithQrCode = {
  address: defaultRecipientAddress,
  displayName: 'Celo Default Recipient',
  displayId: defaultRecipientPhoneNumber,
  kind: RecipientKind.QrCode,
  e164PhoneNumber: defaultRecipientPhoneNumber,
}

interface Section {
  key: string
  data: Recipient[]
}

interface State {
  loading: boolean
  searchQuery: string
  allFiltered: Recipient[]
  recentFiltered: Recipient[]
  hasGivenPermission: boolean
}

interface StateProps {
  defaultCountryCode: string
  e164PhoneNumber: string
  devModeActive: boolean
  e164PhoneNumberAddressMapping: E164NumberToAddressType
  recentRecipients: Recipient[]
  allRecipients: Recipient[]
}

interface DispatchProps {
  showError: typeof showError
  hideAlert: typeof hideAlert
  storeLatestInRecents: typeof storeLatestInRecents
  importContacts: typeof importContacts
}

type Props = StateProps & DispatchProps & WithNamespaces & NavigationInjectedProps

const mapStateToProps = (state: RootState): StateProps => ({
  defaultCountryCode: state.account.defaultCountryCode,
  e164PhoneNumber: state.account.e164PhoneNumber,
  devModeActive: state.account.devModeActive || false,
  e164PhoneNumberAddressMapping: state.identity.e164NumberToAddress,
  recentRecipients: [CeloDefaultRecipient, ...state.send.recentRecipients],
  allRecipients: Object.values(recipientCacheSelector(state)),
})

const mapDispatchToProps = {
  showError,
  hideAlert,
  storeLatestInRecents,
  importContacts,
}

type FilterType = (searchQuery: string) => Recipient[]

class Send extends React.Component<Props, State> {
  static navigationOptions = ({ navigation }: NavigationScreenProps) => ({
    headerTitle: navigation.getParam('title', ''),
    headerTitleStyle: [fontStyles.headerTitle, componentStyles.screenHeader],
    // This helps vertically center the title
    headerRight: <View />,
    headerLeft: <CancelButton eventName={CustomEventNames.send_select_cancel} />,
  })

  throttledSearch: (searchQuery: string) => void
  allRecipientsFilter: FilterType
  recentRecipientsFilter: FilterType

  constructor(props: Props) {
    super(props)

    this.state = {
      loading: true,
      searchQuery: '',
      allFiltered: [],
      recentFiltered: [],
      hasGivenPermission: true,
    }

    this.allRecipientsFilter = filterRecipientFactory(this.props.allRecipients)
    this.recentRecipientsFilter = filterRecipientFactory(this.props.recentRecipients)

    this.throttledSearch = throttle((searchQuery: string) => {
      this.setState({
        recentFiltered: this.recentRecipientsFilter(searchQuery),
        allFiltered: this.allRecipientsFilter(searchQuery),
      })
    }, SEARCH_THROTTLE_TIME)
  }

  async componentDidMount() {
    const { t, recentRecipients, allRecipients } = this.props
    this.props.navigation.setParams({ title: t('send_or_request') })

    this.setState({
      loading: false,
      recentFiltered: filterRecipients(recentRecipients, this.state.searchQuery, false),
      allFiltered: filterRecipients(allRecipients, this.state.searchQuery, true),
    })

    const hasGivenPermission = await checkContactsPermission()
    this.setState({ hasGivenPermission })
  }

  onSearchQueryChanged = (searchQuery: string) => {
    this.props.hideAlert()
    this.setState({
      searchQuery,
    })
    this.throttledSearch(searchQuery)
  }

  onSelectRecipient = (recipient: Recipient) => {
    this.props.hideAlert()
    CeloAnalytics.track(CustomEventNames.send_input, {
      selectedRecipientAddress: recipient.address,
    })

    if (!recipient.e164PhoneNumber && !recipient.address) {
      this.props.showError(ErrorMessages.CANT_SELECT_INVALID_PHONE, ALERT_BANNER_DURATION)
      return
    }

    if (
      (recipient.e164PhoneNumber && recipient.e164PhoneNumber !== defaultRecipientPhoneNumber) ||
      (recipient.address && recipient.address !== defaultRecipientAddress)
    ) {
      this.props.storeLatestInRecents(recipient)
    }

    navigate(Screens.SendAmount, { recipient })
  }

  onPermissionsAccepted = async () => {
    this.props.importContacts()
    this.setState({
      searchQuery: '',
      hasGivenPermission: true,
    })
  }

  buildSections = (): Section[] => {
    const { t } = this.props
    const { recentFiltered, allFiltered } = this.state
    const sections = [
      { key: t('recent'), data: recentFiltered },
      { key: t('contacts'), data: allFiltered },
    ].filter((section) => section.data.length > 0)

    return sections
  }

  render() {
    const { t, defaultCountryCode } = this.props
    const { loading, searchQuery } = this.state

    return (
      <View style={style.body}>
        {loading ? (
          <View style={style.container}>
            <ActivityIndicator style={style.icon} size="large" color={colors.celoGreen} />
            <Text style={[fontStyles.bodySecondary]}>{t('loadingContacts')}</Text>
          </View>
        ) : (
          <RecipientPicker
            sections={this.buildSections()}
            searchQuery={searchQuery}
            defaultCountryCode={defaultCountryCode}
            hasAcceptedContactPermission={this.state.hasGivenPermission}
            onSelectRecipient={this.onSelectRecipient}
            onSearchQueryChanged={this.onSearchQueryChanged}
            showQRCode={true}
            onPermissionsAccepted={this.onPermissionsAccepted}
          />
        )}
      </View>
    )
  }
}

const style = StyleSheet.create({
  body: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  icon: {
    marginBottom: 20,
    height: 60,
    width: 60,
  },
})

export default componentWithAnalytics(
  connect<StateProps, DispatchProps, {}, RootState>(
    mapStateToProps,
    mapDispatchToProps
  )(withNamespaces(Namespaces.sendFlow7)(withNavigation(Send)))
)
